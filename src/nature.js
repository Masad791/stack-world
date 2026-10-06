import * as THREE from 'three';
import { ZONES, ARENA, GROVE, SECRETS } from './data.js';

// Four moods the player can cycle through. Everything here is cross-faded, never switched.
export const MOODS = {
  morning: {
    label: 'Morning', unlit: 1, mist: 0.38, pollen: 1, skyTop: '#5eb4ff', skyBottom: '#d9f1ff', sunGlow: '#fff6d8', fog: '#cfeaff', fogNear: 70, fogFar: 160,
    hemiSky: '#dff1ff', hemiGround: '#6f9e4f', hemi: 1.4, sun: '#fff4e0', sunI: 2.4, sunPos: [25, 40, 12],
    sea: '#5cc8f0', grass: '#8fcf6a', lamps: 0, fireflies: 0, petals: 0, bloom: 0.25, exposure: 1,
  },
  golden: {
    label: 'Golden hour', unlit: 0.9, mist: 0.28, pollen: 0.7, skyTop: '#ff9e7a', skyBottom: '#ffe2a8', sunGlow: '#ffd27a', fog: '#ffd9b0', fogNear: 55, fogFar: 140,
    hemiSky: '#ffd6b0', hemiGround: '#7a6a3a', hemi: 1.1, sun: '#ffb46b', sunI: 2.8, sunPos: [40, 14, -10],
    sea: '#f2a97a', grass: '#b8c95a', lamps: 1.2, fireflies: 0.2, petals: 0, bloom: 0.45, exposure: 1.05,
  },
  night: {
    label: 'Starry night', unlit: 0.55, mist: 0.3, pollen: 0, skyTop: '#0b1640', skyBottom: '#2a3b78', sunGlow: '#9fb6ff', fog: '#1d2b5c', fogNear: 45, fogFar: 125,
    hemiSky: '#4a5fa8', hemiGround: '#141f30', hemi: 0.7, sun: '#b9c8ff', sunI: 0.65, sunPos: [-20, 35, 25],
    sea: '#1d3a7a', grass: '#3f6f5a', lamps: 3.2, fireflies: 1, petals: 0, bloom: 1.05, exposure: 0.85,
  },
  sakura: {
    label: 'Sakura', unlit: 1, mist: 0.3, pollen: 0.3, skyTop: '#9fc4ff', skyBottom: '#ffe3ee', sunGlow: '#ffffff', fog: '#ffe1ec', fogNear: 60, fogFar: 150,
    hemiSky: '#ffe6f0', hemiGround: '#7f9e6a', hemi: 1.35, sun: '#fff0f5', sunI: 2.2, sunPos: [20, 38, 20],
    sea: '#8fd3f5', grass: '#9fd47a', lamps: 0, fireflies: 0, petals: 1, bloom: 0.3, exposure: 1,
  },
};
// 'cycle' is the living day: the moods above blend through a 24 hour clock while the sun and moon cross the sky.
export const MOOD_ORDER = ['cycle', 'morning', 'golden', 'night', 'sakura'];
const DAY_SECONDS = 300; // one full day and night
const DAY_KEYS = [[0, 'night'], [4.5, 'night'], [5.75, 'golden'], [7.25, 'morning'], [16.5, 'morning'], [18.25, 'golden'], [19.75, 'night'], [24, 'night']];

const COLOR_KEYS = ['skyTop', 'skyBottom', 'sunGlow', 'fog', 'hemiSky', 'hemiGround', 'sun', 'sea', 'grass'];
const NUM_KEYS = ['fogNear', 'fogFar', 'hemi', 'sunI', 'lamps', 'fireflies', 'petals', 'bloom', 'exposure', 'mist', 'pollen', 'unlit'];

// Mood state that is being eased toward the target mood every frame.
function moodState(m) {
  const s = { sunPos: new THREE.Vector3(...m.sunPos) };
  COLOR_KEYS.forEach((k) => (s[k] = new THREE.Color(m[k])));
  NUM_KEYS.forEach((k) => (s[k] = m[k]));
  return s;
}

// Keep grass off district pads, paths, the arena and the grove's clearing.
function openGround(x, z) {
  if (ZONES.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.r + 0.5)) return false;
  if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 1) return false;
  if (Math.hypot(x - GROVE.x, z - GROVE.z) < 5) return false;
  // No grass growing through the pond or across the shrine's stone pad.
  if (SECRETS.some((sc) => (sc.id === 'koi' || sc.id === 'shrine') && Math.hypot(x - sc.x, z - sc.z) < sc.r + 0.5)) return false;
  return ![...ZONES, GROVE].some((zn) => {
    const len2 = zn.x * zn.x + zn.z * zn.z || 1;
    const t = Math.max(0, Math.min(1, (x * zn.x + z * zn.z) / len2));
    return Math.hypot(x - zn.x * t, z - zn.z * t) < 3;
  });
}

// ctx: { scene, hemi, sun, renderer, bloom, sea, islandR, addCollider }
export function createNature(ctx) {
  const { scene, islandR } = ctx;
  const updates = [];
  const wind = { value: 0 };

  // ---------- Sky dome: vertical gradient with a soft glow around the sun ----------
  const skyUniforms = {
    top: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    glow: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; uniform vec3 sunDir; varying vec3 vDir;
        void main() {
          float h = smoothstep(-0.15, 0.7, vDir.y);
          vec3 col = mix(bottom, top, h);
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          col += glow * (pow(s, 24.0) * 0.9 + pow(s, 4.0) * 0.18);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // Stars, only visible at night.
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3().randomDirection();
    v.y = Math.abs(v.y) * 0.9 + 0.1;
    v.normalize().multiplyScalar(300);
    starPos.set([v.x, v.y, v.z], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);

  // ---------- Clouds: clusters of soft spheres drifting around the island ----------
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.95 });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 3, 1), cloudMat);
      puff.position.set((k - n / 2) * 3.4, Math.random() * 2, (Math.random() - 0.5) * 4);
      puff.scale.y = 0.7;
      g.add(puff);
    }
    const a = (i / 9) * Math.PI * 2;
    const r = 50 + Math.random() * 60;
    g.userData = { a, r, y: 34 + Math.random() * 14, speed: 0.008 + Math.random() * 0.01 };
    scene.add(g);
    clouds.push(g);
  }
  updates.push((dt) => clouds.forEach((c) => {
    c.userData.a += c.userData.speed * dt;
    c.position.set(Math.cos(c.userData.a) * c.userData.r, c.userData.y, Math.sin(c.userData.a) * c.userData.r);
    c.rotation.y = -c.userData.a;
  }));

  // ---------- Grass: thousands of instanced blades swaying in shader-driven wind ----------
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, 0.75, 0], 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute([1.0, 1.02, 0.96, 1.0, 1.02, 0.96, 1.3, 1.28, 1.1], 3));
  // Normals point straight up, so blades are lit like the ground from any side (no dark backfaces).
  blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  const grassMat = new THREE.MeshStandardMaterial({ color: '#8fcf6a', vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // Only the tip moves; phase depends on world position so waves roll across the field.
         vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         float sway = sin(uTime * 1.8 + wp.x * 0.35 + wp.z * 0.25) * 0.22 + sin(uTime * 4.0 + wp.x) * 0.05;
         transformed.x += sway * position.y;
         transformed.z += sway * 0.6 * position.y;`
      );
  };
  const GRASS = 16000;
  const grass = new THREE.InstancedMesh(blade, grassMat, GRASS);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let placed = 0;
  for (let tries = 0; placed < GRASS && tries < GRASS * 4; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (islandR - 2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!openGround(x, z)) continue;
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    const s = 0.6 + Math.random() * 0.7;
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.8 + Math.random() * 0.6), s));
    grass.setMatrixAt(placed++, m);
  }
  grass.count = placed;
  grass.receiveShadow = true;
  scene.add(grass);

  // ---------- Lamps along every path (they glow at dusk and night) ----------
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffb64d', emissiveIntensity: 0 });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.6 });
  ZONES.filter((zn) => zn.id !== 'plaza').forEach((zn) => {
    const len = Math.hypot(zn.x, zn.z);
    const dir = { x: zn.x / len, z: zn.z / len };
    for (let d = 14; d < len - zn.r - 2; d += 12) {
      const x = dir.x * d - dir.z * 3.3;
      const z = dir.z * d + dir.x * 3.3;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 6), poleMat);
      pole.position.set(x, 1.5, z);
      pole.castShadow = true;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bulbMat);
      bulb.position.set(x, 3.15, z);
      scene.add(pole, bulb);
      ctx.addCollider(x, z, 0.3);
    }
  });

  // ---------- Birds: a loose flock circling the island, flapping and banking ----------
  // White gull-like birds read softly against grass and sky (very Ghibli), unlike black cut-outs.
  const birdMat = new THREE.MeshStandardMaterial({ color: '#f7f4ee', side: THREE.DoubleSide, flatShading: true });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, 0, 0, -0.25, 1.1, 0, -0.1], 3));
  wingGeo.computeVertexNormals();
  const birds = [];
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 5), birdMat);
    body.rotation.x = Math.PI / 2;
    const left = new THREE.Mesh(wingGeo, birdMat);
    const right = new THREE.Mesh(wingGeo, birdMat);
    right.scale.x = -1;
    g.add(body, left, right);
    g.scale.setScalar(0.95);
    scene.add(g);
    birds.push({
      g, left, right,
      r: 30 + (i % 3) * 7 + Math.random() * 6,
      // Between the treetops and the camera, so they read as birds, not as shapes in the lens.
      y: 11 + Math.random() * 4,
      a: Math.random() * 0.8 + Math.floor(i / 8) * 2.1,
      speed: 0.12 + Math.random() * 0.03,
      phase: Math.random() * 6,
      wobble: Math.random() * 6,
    });
  }
  updates.push((dt, t) => birds.forEach((b) => {
    b.a += b.speed * dt;
    const r = b.r + Math.sin(t * 0.3 + b.wobble) * 6;
    const x = Math.cos(b.a) * r;
    const z = Math.sin(b.a) * r;
    const y = b.y + Math.sin(t * 0.7 + b.wobble) * 1.2;
    b.g.position.set(x, y, z);
    b.g.rotation.set(0, -b.a, 0);
    b.g.rotateZ(0.35); // bank into the turn
    // Flap in bursts, then glide.
    const flap = Math.sin(t * 9 + b.phase) * (0.55 + 0.45 * Math.max(0, Math.sin(t * 0.8 + b.phase)));
    b.left.rotation.z = flap;
    b.right.rotation.z = -flap;
  }));

  // ---------- Air: fireflies, petals, dandelion fluff and mist ----------
  // Every particle has a fixed home in the world plus a shared wind offset. We only *display* them in a
  // box around the player, wrapping at its edges, so the air is full everywhere without anything
  // travelling along with Byte.
  const windState = { angle: 0.6, speed: 1.2, x: 0, z: 0 };
  const wrapNear = (v, center, size) => center + ((((v - center + size / 2) % size) + size) % size) - size / 2;
  const edgeFade = (v, center, size) => Math.min(1, (size / 2 - Math.abs(v - center)) / (size * 0.15));
  // Soft round dot so points read as glowing specks, not squares.
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = dotCanvas.height = 64;
  const dg = dotCanvas.getContext('2d');
  const dgrad = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
  dgrad.addColorStop(0, 'rgba(255,255,255,1)');
  dgrad.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  dgrad.addColorStop(1, 'rgba(255,255,255,0)');
  dg.fillStyle = dgrad;
  dg.fillRect(0, 0, 64, 64);
  const dotTex = new THREE.CanvasTexture(dotCanvas);
  const pointCloud = (count, size, color, blending = THREE.NormalBlending) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, color, transparent: true, opacity: 0, depthWrite: false, blending }));
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  };
  const randomSeeds = (n, box, extra) => Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * box, z: (Math.random() - 0.5) * box, p: Math.random() * 6, ...extra() }));

  const FLY_BOX = 110;
  const flies = pointCloud(220, 1.4, '#fff3a0', THREE.AdditiveBlending);
  const flySeed = randomSeeds(220, FLY_BOX, () => ({ y: 0.5 + Math.random() * 3 }));

  const POLLEN_BOX = 90;
  const pollen = pointCloud(260, 0.35, '#ffffff');
  const pollenSeed = randomSeeds(260, POLLEN_BOX, () => ({ y: 1 + Math.random() * 9, s: 0.6 + Math.random() * 0.8 }));

  const PETAL_BOX = 90;
  const PETALS = 260;
  const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.2), new THREE.MeshStandardMaterial({ color: '#ffb7cf', side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), PETALS);
  petals.frustumCulled = false;
  const petalSeed = randomSeeds(PETALS, PETAL_BOX, () => ({ y: Math.random() * 25, s: 0.6 + Math.random() }));
  petals.visible = false;
  scene.add(petals);

  // Mist: big soft sprites resting low over the island, drifting on the wind.
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = mistCanvas.height = 128;
  const mg = mistCanvas.getContext('2d');
  const grad = mg.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  mg.fillStyle = grad;
  mg.fillRect(0, 0, 128, 128);
  const mistMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mistCanvas), transparent: true, opacity: 0, depthWrite: false, color: '#ffffff' });
  const mists = Array.from({ length: 34 }, () => {
    const sp = new THREE.Sprite(mistMat);
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (islandR + 6);
    sp.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.8 + Math.random() * 1.6, w: 10 + Math.random() * 9 };
    sp.scale.set(sp.userData.w, sp.userData.w * 0.32, 1);
    scene.add(sp);
    return sp;
  });

  // ---------- Moods ----------
  let cycling = true;
  let hours = 8.5; // the island wakes up mid-morning
  const dayTarget = moodState(MOODS.morning);
  dayTarget.sunPos = [0, 0, 0];
  const moodColors = Object.fromEntries(Object.keys(MOODS).map((name) => [name, moodState(MOODS[name])]));
  // Blend the two moods either side of the current hour, and put the sun (or moon) on its arc.
  const blendDay = () => {
    const i = DAY_KEYS.findIndex(([h]) => h > hours);
    const [h0, a] = DAY_KEYS[i - 1];
    const [h1, b] = DAY_KEYS[i];
    const f = THREE.MathUtils.smoothstep(hours, h0, h1);
    COLOR_KEYS.forEach((k) => dayTarget[k].copy(moodColors[a][k]).lerp(moodColors[b][k], f));
    NUM_KEYS.forEach((k) => (dayTarget[k] = THREE.MathUtils.lerp(MOODS[a][k], MOODS[b][k], f)));
    // Sun from 5:30 to 19:30, moon for the rest; both rise in the east and set in the west.
    const day = (hours - 5.5) / 14;
    const isDay = day >= 0 && day <= 1;
    const arc = isDay ? day : ((hours - 19.5 + 24) % 24) / 10;
    const a2 = arc * Math.PI;
    // The moon rides higher, so moonlight reaches the ground instead of grazing it.
    const y = isDay ? Math.max(6, Math.sin(a2) * 42) : Math.max(18, Math.sin(a2) * 40);
    dayTarget.sunPos[0] = -Math.cos(a2) * 48;
    dayTarget.sunPos[1] = y;
    dayTarget.sunPos[2] = 16;
    // Light fades near the horizon, which also hides the sun-to-moon hand-off.
    dayTarget.sunI *= 0.35 + 0.65 * THREE.MathUtils.smoothstep(y, 6, 18);
  };
  blendDay();
  let target = dayTarget;
  const cur = moodState(MOODS.morning);
  COLOR_KEYS.forEach((k) => cur[k].copy(dayTarget[k]));
  NUM_KEYS.forEach((k) => (cur[k] = dayTarget[k]));
  cur.sunPos.set(...dayTarget.sunPos);
  const tmp = new THREE.Color();
  const sunTarget = new THREE.Vector3();
  // Labels, name tags, bubbles, billboard screens and orb faces are unlit textures: at full white they
  // cross the bloom threshold at night and glow. Collected once (after everything is built) and dimmed per mood.
  let unlitMats = null;
  const collectUnlit = () => {
    unlitMats = [];
    scene.traverse((o) => {
      const m = o.material;
      if (m && !Array.isArray(m) && m.map && (m.isSpriteMaterial || m.isMeshBasicMaterial) && m !== mistMat) unlitMats.push(m);
    });
  };
  const apply = () => {
    skyUniforms.top.value.copy(cur.skyTop);
    skyUniforms.bottom.value.copy(cur.skyBottom);
    skyUniforms.glow.value.copy(cur.sunGlow);
    scene.fog.color.copy(cur.fog);
    scene.fog.near = cur.fogNear;
    scene.fog.far = cur.fogFar;
    ctx.hemi.color.copy(cur.hemiSky);
    ctx.hemi.groundColor.copy(cur.hemiGround);
    ctx.hemi.intensity = cur.hemi;
    ctx.sun.color.copy(cur.sun);
    ctx.sun.intensity = cur.sunI;
    ctx.sea.material.color.copy(cur.sea);
    ctx.islandTop.material.color.copy(cur.grass);
    grassMat.color.copy(cur.grass);
    bulbMat.emissiveIntensity = cur.lamps;
    flies.material.opacity = cur.fireflies;
    pollen.material.opacity = cur.pollen * 0.85;
    mistMat.opacity = cur.mist;
    mistMat.color.copy(cur.fog).lerp(tmp.set('#ffffff'), 0.5);
    stars.material.opacity = Math.max(0, cur.fireflies - 0.3) * 1.3;
    petals.visible = cur.petals > 0.05;
    petals.material.opacity = cur.petals;
    if (ctx.bloom) ctx.bloom.strength = cur.bloom;
    ctx.renderer.toneMappingExposure = cur.exposure;
    // A cool tint as it dims, so text at night reads like moonlit paper, not a lamp.
    unlitMats?.forEach((m) => m.color.setRGB(cur.unlit, cur.unlit, Math.min(1, cur.unlit * 1.12)));
  };
  apply();

  return {
    get sunOffset() {
      return cur.sunPos;
    },
    get wind() {
      return windState.speed;
    },
    // What the weather needs to grey the sky, flatten the grass and drift with the wind.
    handles: { skyUniforms, cloudMat, grassMat, stars, flies, pollen, windState, birds },
    get hours() {
      return hours;
    },
    get clockLabel() {
      const h = Math.floor(hours);
      const m = Math.floor((hours % 1) * 6) * 10;
      return `${hours >= 5.5 && hours < 19.5 ? 'Day' : 'Night'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
    setMood(name) {
      cycling = name === 'cycle';
      target = cycling ? dayTarget : MOODS[name];
    },
    update(dt, t, player) {
      if (cycling) {
        hours = (hours + (dt * 24) / DAY_SECONDS) % 24;
        blendDay();
      }
      // Logo textures load asynchronously, so keep re-collecting for the first few seconds.
      if (!unlitMats || (t < 8 && Math.floor(t) !== Math.floor(t - dt))) collectUnlit();
      wind.value = t;
      // Ease every mood value toward the target (about a two second cross-fade).
      const k = Math.min(1, dt * 1.6);
      COLOR_KEYS.forEach((key) => cur[key].lerp(tmp.set(target[key]), k));
      NUM_KEYS.forEach((key) => (cur[key] += (target[key] - cur[key]) * k));
      cur.sunPos.lerp(sunTarget.set(...target.sunPos), k);
      skyUniforms.sunDir.value.copy(cur.sunPos).normalize();
      apply();

      // The sky and stars follow the camera so they always feel infinitely far away.
      sky.position.set(player.x, 0, player.z);
      stars.position.copy(sky.position);
      updates.forEach((fn) => fn(dt, t));

      // Wind slowly changes direction, so drift never looks mechanical.
      windState.angle = 0.6 + Math.sin(t * 0.05) * 0.9;
      windState.speed = 1 + Math.sin(t * 0.13) * 0.5;
      windState.x += Math.cos(windState.angle) * windState.speed * dt;
      windState.z += Math.sin(windState.angle) * windState.speed * dt;

      if (cur.fireflies > 0.02) {
        const pos = flies.geometry.attributes.position.array;
        const col = flies.geometry.attributes.color.array;
        flySeed.forEach((f, i) => {
          // Fireflies wander around their own spot and barely notice the wind.
          const x = wrapNear(f.x + Math.sin(t * 0.6 + f.p) * 2 + windState.x * 0.15, player.x, FLY_BOX);
          const z = wrapNear(f.z + Math.cos(t * 0.5 + f.p) * 2 + windState.z * 0.15, player.z, FLY_BOX);
          pos.set([x, f.y + Math.sin(t * 1.3 + f.p * 2) * 0.6, z], i * 3);
          const glow = Math.max(0, edgeFade(x, player.x, FLY_BOX) * edgeFade(z, player.z, FLY_BOX)) * (0.5 + 0.5 * Math.sin(t * 3 + f.p * 5));
          col.set([glow, glow, glow], i * 3);
        });
        flies.geometry.attributes.position.needsUpdate = true;
        flies.geometry.attributes.color.needsUpdate = true;
      }
      if (cur.pollen > 0.02) {
        const pos = pollen.geometry.attributes.position.array;
        const col = pollen.geometry.attributes.color.array;
        pollenSeed.forEach((f, i) => {
          const x = wrapNear(f.x + windState.x * f.s + Math.sin(t * 0.7 + f.p) * 0.8, player.x, POLLEN_BOX);
          const z = wrapNear(f.z + windState.z * f.s + Math.cos(t * 0.6 + f.p) * 0.8, player.z, POLLEN_BOX);
          pos.set([x, f.y + Math.sin(t * 0.9 + f.p) * 0.8, z], i * 3);
          const a = Math.max(0, edgeFade(x, player.x, POLLEN_BOX) * edgeFade(z, player.z, POLLEN_BOX));
          col.set([a, a, a], i * 3);
        });
        pollen.geometry.attributes.position.needsUpdate = true;
        pollen.geometry.attributes.color.needsUpdate = true;
      }
      if (petals.visible) {
        petalSeed.forEach((p, i) => {
          p.y -= dt * 1.4 * p.s;
          if (p.y < 0) p.y = 25;
          const x = wrapNear(p.x + windState.x * 1.6 * p.s + Math.sin(t * 0.8 + p.p) * 2.5, player.x, PETAL_BOX);
          const z = wrapNear(p.z + windState.z * 1.6 * p.s + Math.cos(t * 0.6 + p.p) * 2, player.z, PETAL_BOX);
          const fade = Math.max(0, edgeFade(x, player.x, PETAL_BOX) * edgeFade(z, player.z, PETAL_BOX)) * p.s;
          q.setFromEuler(new THREE.Euler(t * 2 + p.p, t * 1.3 + p.p, t + p.p));
          m.compose(new THREE.Vector3(x, p.y, z), q, new THREE.Vector3(fade, fade, fade));
          petals.setMatrixAt(i, m);
        });
        petals.instanceMatrix.needsUpdate = true;
      }
      if (cur.mist > 0.02) {
        mists.forEach((sp) => {
          const u = sp.userData;
          let x = u.x + windState.x * 0.6;
          let z = u.z + windState.z * 0.6;
          // Mist that drifts off the island comes back in on the far side.
          const r = Math.hypot(x, z);
          if (r > islandR + 8) {
            u.x -= (x / r) * (islandR + 8) * 2;
            u.z -= (z / r) * (islandR + 8) * 2;
            x = u.x + windState.x * 0.6;
            z = u.z + windState.z * 0.6;
          }
          sp.position.set(x, u.y, z);
        });
      }
    },
  };
}
