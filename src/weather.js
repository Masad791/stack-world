import * as THREE from 'three';
import { ZONES, GROVE } from './data.js';

// Weather: rain (streaks, splashes, spray, rippling puddles that grow as the ground soaks), snow
// (flakes, cover that settles on every upward-facing surface, footprints) and the sky that goes
// with them (overcast light, lightning, thunder, the sound of rain).
//
// The rain is entirely on the GPU: every drop's position is a function of time and its seed, so a
// drop, its splash ring and its spray all agree on where and when it lands without any CPU work.

const GLSL_HASH = `
  vec2 wxH2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
  float wxHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float wxNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), f.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

// One drop's life: fall from uTop, land at p (on the island, the beach or the sea), then splash.
const DROP_COMMON = `
  float speed = 26.0 * (0.85 + 0.3 * aSeed.w);
  float fallT = uTop / speed;
  float period = fallT + 0.38;
  float tt = uTime + aSeed.z * period * 7.0;
  float cycle = floor(tt / period);
  float local = tt - cycle * period;
  // A fresh spot every cycle, anchored in the world and only wrapped (and faded) at the box edges.
  vec2 base = wxH2(aSeed.xy * 61.7 + cycle * vec2(0.731, 0.379)) * uBox;
  vec2 p = uCenter + mod(base - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  float rr = length(p);
  float g = rr < uIslandR ? 0.12 : (rr < uIslandR + 3.0 ? -0.4 : -1.05);
  vec2 rel = p - uCenter;
  float fade = clamp((uBox * 0.5 - max(abs(rel.x), abs(rel.y))) / (uBox * 0.12), 0.0, 1.0);
  bool alive = fract(aSeed.z * 13.37 + aSeed.x * 3.1) < uRain;`;
const HIDE = 'gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return;';

const TONE = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

// Every lit material gets wet (darker, glossier) and snowy (white where it faces the sky).
function patchMaterial(m, U, { noSnow = false, grass = false } = {}) {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey();
  if (noSnow) m.defines = { ...m.defines, WX_NO_SNOW: '' };
  if (grass) m.defines = { ...m.defines, WX_GRASS: '' };
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.uWet = U.wet;
    shader.uniforms.uSnow = U.snow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying vec3 vWxPos;\nvarying vec3 vWxN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef WX_GRASS
           transformed.y *= 1.0 - uSnow * 0.7; // blades bend under the snow
         #endif`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vec4 wxP = vec4(transformed, 1.0);
         vec3 wxN = objectNormal;
         #ifdef USE_INSTANCING
           wxP = instanceMatrix * wxP;
           wxN = mat3(instanceMatrix) * wxN;
         #endif
         vWxPos = (modelMatrix * wxP).xyz;
         vWxN = normalize(mat3(modelMatrix) * wxN);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWet;\nuniform float uSnow;\nvarying vec3 vWxPos;\nvarying vec3 vWxN;\n${GLSL_HASH}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float wxCover = 0.0;
         #ifndef WX_NO_SNOW
         if (uSnow > 0.001) {
           // Patchy at first, then a full blanket; steep sides stay bare.
           float n = wxNoise(vWxPos.xz * 0.45) * 0.6 + wxNoise(vWxPos.xz * 2.3) * 0.4;
           float level = smoothstep(0.3, 0.9, vWxN.y);
           // Slopes only get a dusting, but tree tops and roofs (anything high and not vertical) get caps.
           float caps = step(0.2, vWxN.y) * smoothstep(3.4, 5.6, vWxPos.y) * 0.8;
           float amount = (level * 1.6 + caps) * uSnow - n * 0.55;
           wxCover = smoothstep(0.0, 0.25, amount);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.96), wxCover);
         }
         #endif
         diffuseColor.rgb *= 1.0 - uWet * 0.3 * (1.0 - wxCover);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.3, uWet * (1.0 - wxCover) * smoothstep(0.3, 0.9, vWxN.y));
         roughnessFactor = mix(roughnessFactor, 0.85, wxCover);`
      );
  };
  m.customProgramCacheKey = () => `${prevKey}|wx`;
  m.needsUpdate = true;
}

// ctx: { scene, camera, renderer, nature, world, sun, hemi, islandR, noSnow: Object3D[], getAudio, soundOn: () => bool, touch }
export function createWeather(ctx) {
  const { scene, camera, nature, world, islandR } = ctx;
  const { skyUniforms, cloudMat, grassMat, stars, flies, pollen, windState, birds } = nature.handles;

  const U = {
    wet: { value: 0 },
    snow: { value: 0 },
    time: { value: 0 },
    rain: { value: 0 },
    snowFall: { value: 0 },
    center: { value: new THREE.Vector2() },
    windVel: { value: new THREE.Vector2() },
    drift: { value: new THREE.Vector2() },
    camRight: { value: new THREE.Vector3(1, 0, 0) },
    tint: { value: new THREE.Color() },
    px: { value: 1000 },
  };

  // ---------- Wet and snowy materials ----------
  const noSnowMats = new Set();
  ctx.noSnow.forEach((o) => o.traverse((c) => c.material && [c.material].flat().forEach((m) => noSnowMats.add(m))));
  const patched = new Set();
  scene.traverse((o) => {
    [o.material].flat().forEach((m) => {
      if (!m || patched.has(m) || !m.isMeshStandardMaterial) return;
      if (m.transparent || m === ctx.world.sea.material) return; // water and clouds hold no snow
      patched.add(m);
      patchMaterial(m, U, { noSnow: noSnowMats.has(m), grass: m === grassMat });
    });
  });

  // ---------- Rain: streaks, splash rings and spray ----------
  const DROPS = ctx.touch ? 3500 : 7000;
  const seeds = new Float32Array(DROPS * 4).map(() => Math.random());
  const dropUniforms = {
    uTime: U.time, uRain: U.rain, uCenter: U.center, uWindVel: U.windVel, uCamRight: U.camRight, uTint: U.tint, uPx: U.px,
    uTop: { value: 24 }, uBox: { value: 64 }, uIslandR: { value: islandR },
  };
  const header = `attribute vec4 aSeed; uniform float uTime, uRain, uTop, uBox, uIslandR, uPx; uniform vec2 uCenter, uWindVel; uniform vec3 uCamRight; ${GLSL_HASH}`;

  const streakGeo = new THREE.InstancedBufferGeometry();
  streakGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  streakGeo.setIndex([0, 1, 2, 2, 1, 3]);
  streakGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  streakGeo.instanceCount = DROPS;
  const streaks = new THREE.Mesh(streakGeo, new THREE.ShaderMaterial({
    uniforms: dropUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `${header} varying float vY; varying float vA;
      void main() {
        ${DROP_COMMON}
        float fallLeft = fallT - local;
        if (!alive || fallLeft < 0.0) { ${HIDE} }
        vec3 vel = vec3(uWindVel.x, -speed, uWindVel.y);
        vec3 head = vec3(p.x - uWindVel.x * fallLeft, g + speed * fallLeft, p.y - uWindVel.y * fallLeft);
        // Motion-blurred streak, a little longer for fast drops, always facing the camera.
        vec3 wp = head - normalize(vel) * (1.1 + aSeed.w * 0.6) * position.y + uCamRight * position.x * 0.022;
        vY = position.y; vA = fade;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform vec3 uTint; varying float vY; varying float vA;
      void main() { gl_FragColor = vec4(uTint, (1.0 - vY) * vY * 4.0 * vA * 0.2); ${TONE} }`,
  }));

  const ringGeo = new THREE.InstancedBufferGeometry();
  ringGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
  ringGeo.setIndex([0, 2, 1, 1, 2, 3]);
  ringGeo.setAttribute('aSeed', streakGeo.getAttribute('aSeed'));
  ringGeo.instanceCount = DROPS;
  const rings = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
    uniforms: dropUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `${header} varying vec2 vQ; varying float vA;
      void main() {
        ${DROP_COMMON}
        float age = (local - fallT) / 0.38;
        if (!alive || age < 0.0) { ${HIDE} }
        float r = 0.04 + age * 0.28; // the crown ring spreads out from where the drop hit
        vec3 wp = vec3(p.x + position.x * r * 2.0, g + 0.015, p.y + position.z * r * 2.0);
        vQ = position.xz * 2.0; vA = (1.0 - age) * fade;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform vec3 uTint; varying vec2 vQ; varying float vA;
      void main() {
        float d = length(vQ);
        float ring = smoothstep(0.7, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d));
        gl_FragColor = vec4(uTint, ring * vA * 0.32); ${TONE}
      }`,
  }));

  // Spray: three droplets per drop jump up and fall back under gravity.
  const SPRAY = 3;
  const sprayGeo = new THREE.BufferGeometry();
  const spraySeed = new Float32Array(DROPS * SPRAY * 4);
  const sprayK = new Float32Array(DROPS * SPRAY);
  for (let i = 0; i < DROPS; i++) {
    for (let k = 0; k < SPRAY; k++) {
      spraySeed.set(seeds.subarray(i * 4, i * 4 + 4), (i * SPRAY + k) * 4);
      sprayK[i * SPRAY + k] = k;
    }
  }
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DROPS * SPRAY * 3), 3));
  sprayGeo.setAttribute('aSeed', new THREE.BufferAttribute(spraySeed, 4));
  sprayGeo.setAttribute('aK', new THREE.BufferAttribute(sprayK, 1));
  const spray = new THREE.Points(sprayGeo, new THREE.ShaderMaterial({
    uniforms: dropUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `${header} attribute float aK; varying float vA;
      void main() {
        ${DROP_COMMON}
        float tau = local - fallT;
        if (!alive || tau < 0.0 || g < 0.0) { ${HIDE} }
        vec2 rnd = wxH2(aSeed.xy * 17.3 + aK * 3.1 + cycle * 0.11);
        float ang = rnd.x * 6.2832;
        float hs = 0.6 + rnd.y;
        vec3 wp = vec3(p.x + cos(ang) * hs * tau, g + (2.2 + rnd.y * 1.4) * tau - 9.0 * tau * tau, p.y + sin(ang) * hs * tau);
        if (wp.y < g) { ${HIDE} }
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, 0.07 * uPx / -mv.z);
        vA = fade * (1.0 - tau / 0.38);
      }`,
    fragmentShader: `uniform vec3 uTint; varying float vA;
      void main() { if (length(gl_PointCoord - 0.5) > 0.5) discard; gl_FragColor = vec4(uTint, vA * 0.7); ${TONE} }`,
  }));
  [streaks, rings, spray].forEach((o) => {
    o.frustumCulled = false;
    o.visible = false;
    scene.add(o);
  });

  // ---------- Puddles: grow from irregular noise blobs as the ground soaks, reflect the sky ----------
  const spots = [];
  const free = (x, z, r) => !world.colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) && !spots.some((s) => Math.hypot(x - s.x, z - s.z) < (s.s + r) * 0.5);
  const tryAdd = (x, z, s) => free(x, z, s * 0.45) && spots.push({ x, z, s });
  [...ZONES.filter((zn) => zn.id !== 'plaza'), GROVE].forEach((zn) => {
    const len = Math.hypot(zn.x, zn.z);
    const side = { x: -zn.z / len, z: zn.x / len };
    for (let k = 0; k < 3; k++) {
      const t = 0.28 + k * 0.22 + Math.random() * 0.08;
      const off = (Math.random() - 0.5) * 2.8;
      tryAdd(zn.x * t + side.x * off, zn.z * t + side.z * off, 2.6 + Math.random() * 2);
    }
    if (zn.r > 9) tryAdd(zn.x + (Math.random() - 0.5) * zn.r, zn.z + (Math.random() - 0.5) * zn.r, 3 + Math.random() * 1.5);
  });
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    tryAdd(Math.sin(a) * 6.2, Math.cos(a) * 6.2, 2.4);
  }
  const fogU = { fogColor: { value: scene.fog.color }, fogNear: { value: 0 }, fogFar: { value: 1 } };
  const puddleMat = new THREE.ShaderMaterial({
    uniforms: {
      uWet: U.wet, uRainP: U.rain, uTime: U.time,
      uSkyTop: skyUniforms.top, uSkyBottom: skyUniforms.bottom, uGlow: skyUniforms.glow, uSunDir: skyUniforms.sunDir,
      ...fogU,
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    vertexShader: `varying vec3 vWorld; varying vec2 vLocal; varying vec2 vSeed;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz; vLocal = position.xz * 2.0; vSeed = instanceMatrix[3].xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform float uWet, uRainP, uTime, fogNear, fogFar;
      uniform vec3 uSkyTop, uSkyBottom, uGlow, uSunDir, fogColor;
      varying vec3 vWorld; varying vec2 vLocal; varying vec2 vSeed;
      ${GLSL_HASH}
      void main() {
        float n = wxNoise(vLocal * 1.6 + vSeed * 0.37) * 0.65 + wxNoise(vLocal * 4.1 + vSeed) * 0.35;
        float shape = 1.0 - length(vLocal) + (n - 0.5) * 0.8;
        float th = mix(1.0, 0.12, uWet);
        float water = smoothstep(th, th + 0.06, shape);
        float damp = smoothstep(th - 0.25, th, shape) * (1.0 - water); // darker soaked rim
        if (water + damp < 0.01) discard;

        // Raindrop ripples: one possible drop per cell, each ring expanding and fading.
        vec2 grad = vec2(0.0);
        if (uRainP > 0.01) {
          vec2 q = vWorld.xz * 1.7; vec2 i = floor(q); vec2 f = fract(q);
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 h = wxH2(i + o);
            if (h.y > uRainP) continue;
            float t = fract(uTime * 1.1 + h.x * 5.3);
            vec2 d = o + h - f;
            float dist = length(d);
            float r = t * 0.9;
            float env = (1.0 - t) * (1.0 - t) * smoothstep(0.18, 0.0, abs(dist - r));
            grad += d / max(dist, 0.001) * cos((dist - r) * 28.0) * env;
          }
        }
        vec3 N = normalize(vec3(-grad.x * 0.45, 1.0, -grad.y * 0.45));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyBottom, uSkyTop, smoothstep(-0.15, 0.7, R.y));
        sky += uGlow * pow(max(dot(R, normalize(uSunDir)), 0.0), 60.0) * 1.2;
        float F = 0.12 + 0.88 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 col = mix(uSkyBottom * 0.16, sky, F);
        // A thin bright meniscus where the water meets the ground.
        col += sky * 0.35 * smoothstep(th + 0.06, th, shape) * water;
        col = mix(uSkyBottom * 0.05, col, water);
        col = mix(col, fogColor, smoothstep(fogNear, fogFar, length(cameraPosition - vWorld)));
        gl_FragColor = vec4(col, water * 0.88 + damp * 0.3);
        ${TONE}
      }`,
  });
  const puddles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), puddleMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    puddles.setMatrixAt(i, m4.compose(new THREE.Vector3(s.x, 0.11, s.z), q, new THREE.Vector3(s.s, 1, s.s)));
  });
  puddles.visible = false;
  scene.add(puddles);

  // ---------- Snowfall ----------
  const FLAKES = ctx.touch ? 2500 : 5000;
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLAKES * 3), 3));
  flakeGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(FLAKES * 4).map(() => Math.random()), 4));
  const flakes = new THREE.Points(flakeGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uSnowFall: U.snowFall, uCenter: U.center, uDrift: U.drift, uTint: U.tint, uPx: U.px, uBox: { value: 70 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uSnowFall, uPx, uBox; uniform vec2 uCenter, uDrift; varying float vA;
      void main() {
        if (fract(aSeed.z * 7.13 + aSeed.y) > uSnowFall) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        float fall = 1.0 + aSeed.w * 0.9;
        float y = 26.0 - mod(uTime * fall + aSeed.z * 26.0, 26.0);
        // Flakes tumble: a slow sideways sway on top of the wind.
        vec2 base = aSeed.xy * uBox + uDrift * (0.8 + aSeed.w * 0.5)
          + vec2(sin(uTime * 0.9 + aSeed.z * 20.0) * 0.8, cos(uTime * 0.7 + aSeed.x * 20.0) * 0.6);
        vec2 p = uCenter + mod(base - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
        vec2 rel = p - uCenter;
        vA = clamp((uBox * 0.5 - max(abs(rel.x), abs(rel.y))) / (uBox * 0.12), 0.0, 1.0) * smoothstep(0.0, 1.0, y);
        vec4 mv = viewMatrix * vec4(p.x, y, p.y, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, (0.13 + aSeed.w * 0.14) * uPx / -mv.z);
      }`,
    fragmentShader: `uniform vec3 uTint; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uTint, smoothstep(0.5, 0.1, d) * vA * 0.95); ${TONE} }`,
  }));
  flakes.frustumCulled = false;
  flakes.visible = false;
  scene.add(flakes);

  // ---------- Footprints in the snow ----------
  const PRINTS = 140;
  const printMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  const prints = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), printMat, PRINTS);
  prints.frustumCulled = false;
  const printData = Array.from({ length: PRINTS }, () => ({ age: 99 }));
  const printCol = new THREE.Color();
  const PRINT_DENT = new THREE.Color('#9aaac4');
  const WHITE = new THREE.Color('#ffffff');
  let printNext = 0;
  let printSide = 1;
  const lastPrint = new THREE.Vector2(1e9, 1e9);
  for (let i = 0; i < PRINTS; i++) {
    prints.setMatrixAt(i, m4.makeScale(0, 0, 0));
    prints.setColorAt(i, WHITE);
  }
  scene.add(prints);

  // ---------- Lightning ----------
  const boltMat = new THREE.MeshBasicMaterial({ color: '#eef2ff', toneMapped: false, fog: false, transparent: true });
  let bolt = null;
  let flashT = 99;
  let nextStrike = 8;
  const strike = (player) => {
    if (bolt) {
      scene.remove(bolt);
      bolt.geometry.dispose();
    }
    // Somewhere out at sea in front of the camera, so the flash is seen, not just felt.
    const a = Math.PI * 1.25 + (Math.random() - 0.5) * 2;
    const d = 85 + Math.random() * 40;
    const x0 = player.x + Math.cos(a) * d;
    const z0 = player.z + Math.sin(a) * d;
    const pts = [];
    let x = x0;
    let z = z0;
    for (let i = 0; i <= 16; i++) {
      pts.push(new THREE.Vector3(x, 60 - i * 3.8, z));
      x += (Math.random() - 0.5) * 5;
      z += (Math.random() - 0.5) * 5;
    }
    bolt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'chordal'), 64, 0.35, 4), boltMat);
    scene.add(bolt);
    flashT = 0;
    thunder(d);
  };

  // ---------- Sound: rain hiss, snow wind, thunder ----------
  let noise = null;
  let rainGain = null;
  let windGain = null;
  const audioReady = () => {
    if (noise || !ctx.soundOn()) return Boolean(noise);
    const ac = ctx.getAudio();
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; // slightly soft white noise
      data[i] = last;
    }
    const loop = (filters, gain) => {
      const src = ac.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      let node = src;
      filters.forEach(([type, freq]) => {
        const f = ac.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        node = node.connect(f);
      });
      gain.gain.value = 0;
      node.connect(gain).connect(ac.destination);
      src.start();
      return gain;
    };
    rainGain = loop([['highpass', 500], ['lowpass', 4500]], ac.createGain());
    windGain = loop([['lowpass', 420]], ac.createGain());
    return true;
  };
  function thunder(dist) {
    if (!audioReady()) return;
    const ac = ctx.getAudio();
    const at = ac.currentTime + dist / 70; // light first, sound later
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.45;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.9, at + 0.08);
    g.gain.exponentialRampToValueAtTime(0.25, at + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
    src.connect(lp).connect(g).connect(ac.destination);
    src.start(at);
    src.stop(at + 3.4);
  }

  // ---------- State ----------
  const MODES = ['auto', 'clear', 'rain', 'snow'];
  let mode = 'auto';
  let kind = 'clear';
  let spell = 40; // seconds until the auto weather changes (first change comes fairly soon)
  const s = { overcast: 0, rain: 0, snowFall: 0, wet: 0, snow: 0 };
  const listeners = [];
  const emit = (reason) => listeners.forEach((fn) => fn({ mode, kind, reason }));
  const toward = (v, goal, rate, dt) => v + THREE.MathUtils.clamp(goal - v, -rate * dt, rate * dt);

  const desat = (c, amount, scale) => {
    const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    c.setRGB(THREE.MathUtils.lerp(c.r, l, amount) * scale, THREE.MathUtils.lerp(c.g, l, amount) * scale, THREE.MathUtils.lerp(c.b, l, amount) * scale);
  };
  const tmpC = new THREE.Color();
  const FLASH = new THREE.Color('#dfe6ff');
  const xAxis = new THREE.Vector3();

  return {
    get mode() {
      return mode;
    },
    get kind() {
      return kind;
    },
    state: s,
    onChange(fn) {
      listeners.push(fn);
    },
    cycle() {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      if (mode === 'auto') spell = 30;
      else kind = mode;
      emit('mode');
    },
    // Is (x, z) inside a puddle that is currently there?
    puddleAt(x, z) {
      if (s.wet < 0.25 || s.snow > 0.3) return false;
      const k = THREE.MathUtils.smoothstep(s.wet, 0.2, 1) * 0.36;
      return spots.some((p) => Math.hypot(x - p.x, z - p.z) < p.s * k);
    },
    update(dt, t, player, heading, moving) {
      // Auto weather: clear spells, then rain or snow, then clear again.
      if (mode === 'auto' && (spell -= dt) < 0) {
        if (kind === 'clear') {
          kind = Math.random() < 0.6 ? 'rain' : 'snow';
          spell = 70 + Math.random() * 40;
        } else {
          kind = 'clear';
          spell = 80 + Math.random() * 60;
        }
        emit('auto');
      }
      // Clouds roll in first; rain or snow only starts once the sky is heavy. Manual picks respond faster.
      const fast = mode === 'auto' ? 1 : 3;
      s.overcast = toward(s.overcast, kind === 'clear' ? 0 : 1, (fast / 9), dt);
      const heavy = s.overcast > 0.6;
      s.rain = toward(s.rain, kind === 'rain' && heavy ? 1 : 0, fast / 12, dt);
      s.snowFall = toward(s.snowFall, kind === 'snow' && heavy ? 1 : 0, fast / 12, dt);
      // The ground soaks and dries slowly; snow settles and melts (faster in rain).
      s.wet = THREE.MathUtils.clamp(s.wet + (s.rain > 0.05 ? (s.rain * fast * dt) / 22 : (-dt * fast) / 70) - s.snowFall * dt * 0.02, 0, 1);
      s.snow = THREE.MathUtils.clamp(s.snow + (s.snowFall > 0.05 ? (s.snowFall * fast * dt) / 28 : (-dt * fast) / 60) - s.rain * dt * 0.06, 0, 1);

      U.time.value = t;
      U.rain.value = s.rain;
      U.snowFall.value = s.snowFall;
      U.wet.value = s.wet;
      U.snow.value = s.snow;
      U.center.value.set(player.x, player.z);
      const gust = windState.speed * 3.2;
      U.windVel.value.set(Math.cos(windState.angle) * gust, Math.sin(windState.angle) * gust);
      U.drift.value.set(windState.x * 1.2, windState.z * 1.2);
      U.camRight.value.copy(xAxis.setFromMatrixColumn(camera.matrixWorld, 0));
      U.px.value = (ctx.renderer.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      streaks.visible = rings.visible = spray.visible = s.rain > 0.01;
      const shelter = s.rain > 0.4 || s.snowFall > 0.6; // birds wait it out
      birds.forEach((b) => (b.g.visible = !shelter));
      flakes.visible = s.snowFall > 0.01;
      puddles.visible = s.wet > 0.01;

      // ---- Sky and light: grey it all down by how heavy the clouds are (keeps the time of day) ----
      const o = s.overcast;
      cloudMat.color.set('#ffffff'); // nature never touches the clouds, so start from white every frame
      if (o > 0.001) {
        const snowy = s.snowFall + s.snow * 0.5 > s.rain ? 1 : 0;
        const dark = snowy ? 1.02 : 0.72;
        // Clouds darken a bright day a lot, but a night only a little, or rainy nights go black.
        const daylight = THREE.MathUtils.smoothstep(ctx.sun.intensity, 0.6, 2.2);
        const dim = o * (0.3 + 0.7 * daylight);
        desat(skyUniforms.top.value, o * 0.85, 1 - dim * (1 - dark));
        desat(skyUniforms.bottom.value, o * 0.8, 1 - dim * (1 - dark) * 0.8);
        skyUniforms.glow.value.multiplyScalar(1 - o * 0.85);
        desat(scene.fog.color, o * 0.7, 1 - dim * (1 - dark) * 0.7);
        scene.fog.near *= 1 - dim * 0.55;
        scene.fog.far *= 1 - dim * 0.3;
        ctx.sun.intensity *= 1 - dim * (snowy ? 0.5 : 0.8);
        // Low clouds bounce a little town and moon light back down on overcast nights.
        ctx.hemi.intensity = ctx.hemi.intensity * (1 - dim * (snowy ? 0.1 : 0.28)) + o * (1 - daylight) * 0.3;
        if (!snowy) ctx.renderer.toneMappingExposure *= 1 - dim * 0.12;
        desat(cloudMat.color, o * 0.6, 1 - o * (snowy ? 0.12 : 0.45));
        stars.material.opacity *= 1 - o;
        pollen.material.opacity *= 1 - o;
        flies.material.opacity *= 1 - s.rain;
      }
      fogU.fogNear.value = scene.fog.near;
      fogU.fogFar.value = scene.fog.far;
      // Drops and flakes catch whatever light there is.
      U.tint.value.copy(scene.fog.color).lerp(tmpC.set('#ffffff'), 0.55);

      // ---- Lightning in heavy rain ----
      if (kind === 'rain' && s.rain > 0.55 && (nextStrike -= dt) < 0) {
        nextStrike = 12 + Math.random() * 18;
        strike(player);
      }
      flashT += dt;
      const flash = Math.exp(-flashT * 18) + (flashT > 0.22 ? Math.exp(-(flashT - 0.22) * 14) * 0.8 : 0);
      if (bolt) bolt.visible = flash > 0.15;
      if (flash > 0.01) {
        ctx.hemi.intensity += flash * 2.2;
        skyUniforms.top.value.lerp(FLASH, flash * 0.7);
        skyUniforms.bottom.value.lerp(FLASH, flash * 0.5);
      }

      // ---- Footprints ----
      printMat.opacity = THREE.MathUtils.smoothstep(s.snow, 0.25, 0.6);
      if (moving && s.snow > 0.3 && Math.hypot(player.x - lastPrint.x, player.z - lastPrint.y) > 0.75) {
        lastPrint.set(player.x, player.z);
        printSide = -printSide;
        const side = 0.32 * printSide;
        const px = player.x + Math.cos(heading) * side;
        const pz = player.z - Math.sin(heading) * side;
        q.setFromAxisAngle(up, heading);
        prints.setMatrixAt(printNext, m4.compose(new THREE.Vector3(px, 0.13, pz), q, new THREE.Vector3(0.42, 1, 0.62)));
        printData[printNext].age = 0;
        printNext = (printNext + 1) % PRINTS;
        prints.instanceMatrix.needsUpdate = true;
      }
      printData.forEach((p, i) => {
        if (p.age > 40) return;
        p.age += dt * (s.snowFall > 0.3 ? 1.6 : 1); // fresh snow fills them in faster
        prints.setColorAt(i, printCol.copy(PRINT_DENT).lerp(WHITE, THREE.MathUtils.smoothstep(p.age, 10, 40)));
      });
      prints.instanceColor.needsUpdate = true;

      // ---- Sound ----
      if ((s.rain > 0.01 || s.snowFall > 0.01) && audioReady()) {
        const ac = ctx.getAudio();
        const on = ctx.soundOn() ? 1 : 0;
        rainGain.gain.setTargetAtTime(s.rain * 0.16 * on, ac.currentTime, 0.4);
        windGain.gain.setTargetAtTime(s.snowFall * 0.07 * on, ac.currentTime, 0.6);
      } else if (rainGain) {
        const ac = ctx.getAudio();
        rainGain.gain.setTargetAtTime(0, ac.currentTime, 0.4);
        windGain.gain.setTargetAtTime(0, ac.currentTime, 0.4);
      }
    },
  };
}
