import * as THREE from 'three';

// Everything outside the walkable top: the island's rocky underside and waterfall, a sea of clouds
// drifting far below, cloud banks sailing past, little floating islets, and airplanes that cruise by
// when you walk up to the edge.

export const NOISE = `
  float sHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float sNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float sFbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * sNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }`;

// Soft cloud puff drawn once: overlapping radial blobs, brighter on top.
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const x = 40 + Math.random() * 176;
    const y = 50 + Math.random() * 40 - Math.abs(x - 128) * 0.15;
    const r = 18 + Math.random() * 30;
    const grad = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(240,244,250,0.55)');
    grad.addColorStop(1, 'rgba(225,232,242,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Jagged rocky cone (point down) with strata colours baked into vertex colours.
export function rockCone(rTop, depth, seg, seed, colors = ['#8a6e50', '#7c6a58', '#6e6862', '#5e5a58']) {
  const geo = new THREE.CylinderGeometry(rTop, rTop * 0.06, depth, seg, 10);
  const pos = geo.attributes.position;
  const col = [];
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = (depth / 2 - y) / depth; // 0 top .. 1 tip
    const a = Math.atan2(z, x);
    if (k > 0.02) {
      const n = Math.sin(a * 7 + seed) * 0.5 + Math.sin(a * 13 + seed * 2 + k * 9) * 0.35 + Math.sin(k * 23 + a * 3) * 0.25;
      const s = 1 + n * 0.14 * Math.min(1, k * 3);
      pos.setX(i, x * s);
      pos.setZ(i, z * s);
      pos.setY(i, y + Math.sin(a * 5 + seed) * depth * 0.02);
    }
    // Earth at the top, then bands of stone getting darker toward the tip.
    const band = Math.floor(k * colors.length * 0.999);
    tmp.set(colors[band]).multiplyScalar(0.92 + 0.16 * Math.sin(k * 40 + a * 2));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function makePlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f7fb, roughness: 0.35, metalness: 0.2 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1f4fae, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c1a33, roughness: 0.1, metalness: 0.5 });
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 9, 8, 16), white);
  fuselage.rotation.z = Math.PI / 2;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 7.5, 16, 1, true), blue);
  stripe.rotation.z = Math.PI / 2;
  stripe.scale.set(1, 1, 0.25);
  stripe.position.y = -0.1;
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), glass);
  cockpit.position.set(4.9, 0.25, 0);
  cockpit.rotation.z = -1.1;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 13), white);
  wing.position.set(0.3, -0.35, 0);
  wing.geometry.translate(0, 0, 0);
  // Swept wings: shear the box backwards along its span.
  const wp = wing.geometry.attributes.position;
  for (let i = 0; i < wp.count; i++) wp.setX(i, wp.getX(i) - Math.abs(wp.getZ(i)) * 0.32);
  wing.geometry.computeVertexNormals();
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.14), blue);
  tail.position.set(-4.6, 1.3, 0);
  const tp = tail.geometry.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) - (tp.getY(i) + 1.2) * 0.45);
  tail.geometry.computeVertexNormals();
  const stab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 4.6), white);
  stab.position.set(-4.7, 0.2, 0);
  const engines = [-2.6, 2.6].map((z) => {
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 1.8, 14), new THREE.MeshStandardMaterial({ color: 0xc9d1de, metalness: 0.6, roughness: 0.3 }));
    e.rotation.z = Math.PI / 2;
    e.position.set(0.6, -0.85, z);
    return e;
  });
  // Navigation lights: red port, green starboard, white strobe.
  const light = (color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    m.position.set(x, y, z);
    return m;
  };
  const port = light(0xff3030, -1.8, -0.3, -6.4);
  const star = light(0x30ff70, -1.8, -0.3, 6.4);
  const strobe = light(0xffffff, -5.5, 2.5, 0);
  g.add(fuselage, stripe, cockpit, wing, tail, stab, ...engines, port, star, strobe);
  // Windows: a row of small dark panes each side.
  const winMat = new THREE.MeshBasicMaterial({ color: 0x1b2a44 });
  for (let i = 0; i < 12; i++) {
    [-0.91, 0.91].forEach((z) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), winMat);
      w.position.set(3.4 - i * 0.62, 0.25, z);
      w.rotation.y = z > 0 ? 0 : Math.PI;
      g.add(w);
    });
  }
  g.traverse((o) => (o.castShadow = false));
  g.userData = { strobe, engines };
  return g;
}

// ctx: { scene, islandR, getAudio, soundOn: () => bool }
export function createSky(ctx) {
  const { scene } = ctx;
  let islandR = ctx.islandR;
  // The island the player is on: cloud banks, islets and passing planes gather around it.
  const C = new THREE.Vector3();
  const updates = [];

  const seaU = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#f4f8ff') },
    uFog: { value: scene.fog.color },
    uFogFar: { value: 400 },
  };
  // Light bouncing up off the cloud sea, so the island's underside isn't a black hole.
  const bounce = new THREE.DirectionalLight('#e6eefc', 0.6);
  bounce.position.set(0.2, -1, 0.3);
  scene.add(bounce);
  updates.push(() => bounce.color.copy(seaU.uColor.value));

  // ---------- Island underside: grass top edge, earth band, layered rock, roots ----------
  const under = new THREE.Mesh(rockCone(islandR + 1.2, 52, 64, 1.3), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  under.position.y = -4.2 - 26;
  scene.add(under);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(islandR + 0.15, islandR + 1.2, 4.2, 72, 1, true), new THREE.MeshStandardMaterial({ color: '#6e563e', roughness: 1, flatShading: true }));
  band.position.y = -2.1;
  scene.add(band);
  // Boulders along the rim and stalactite chunks hanging underneath.
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#8d8a86', roughness: 0.9, flatShading: true });
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + Math.sin(i * 7.3) * 0.05;
    const s = 0.5 + ((i * 37) % 10) / 16;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneMat);
    rock.position.set(Math.cos(a) * (islandR + 0.9), -0.55 + Math.sin(i) * 0.2, Math.sin(a) * (islandR + 0.9));
    rock.rotation.set(i, i * 2, 0);
    rock.scale.y = 0.7;
    rock.castShadow = true;
    scene.add(rock);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const r = 20 + (i % 3) * 14;
    const chunk = new THREE.Mesh(rockCone(5 + (i % 3) * 2, 14 + (i % 4) * 5, 10, i), under.material);
    chunk.position.set(Math.cos(a) * r, -30 - (i % 3) * 8, Math.sin(a) * r);
    scene.add(chunk);
  }
  // Roots dangling off the edge, swaying a little.
  const rootMat = new THREE.MeshStandardMaterial({ color: '#5a4330', roughness: 1 });
  const roots = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.12;
    const len = 4 + ((i * 53) % 7);
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, len, 5), rootMat);
    root.geometry.translate(0, -len / 2, 0);
    root.position.set(Math.cos(a) * (islandR + 0.9), -3.5, Math.sin(a) * (islandR + 0.9));
    root.userData.p = i;
    scene.add(root);
    roots.push(root);
  }
  // (Roots stay still so they batch into a single draw call with the rest of the rock.)

  // Waterfall pouring off the north-west edge into the clouds.
  const fallU = { uTime: { value: 0 } };
  const fallMat = new THREE.ShaderMaterial({
    uniforms: fallU,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; ${NOISE}
      void main() {
        float streaks = sFbm(vec2(vUv.x * 9.0, vUv.y * 2.5 + uTime * 1.6));
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float fade = smoothstep(0.0, 0.35, vUv.y); // dissolves into mist toward the bottom
        vec3 col = mix(vec3(0.62, 0.8, 0.95), vec3(1.0), smoothstep(0.45, 0.8, streaks));
        gl_FragColor = vec4(col, edge * fade * (0.55 + streaks * 0.45));
      }`,
  });
  const wfA = Math.PI * 1.22;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(5, 46, 1, 1), fallMat);
  fall.position.set(Math.cos(wfA) * (islandR + 1.6), -23, Math.sin(wfA) * (islandR + 1.6));
  fall.lookAt(0, -23, 0);
  scene.add(fall);
  updates.push((dt, t) => (fallU.uTime.value = t));

  // ---------- Sea of clouds far below ----------
  const seaMat = new THREE.ShaderMaterial({
    uniforms: seaU,
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform vec3 uFog; uniform float uFogFar; varying vec3 vW; ${NOISE}
      void main() {
        vec2 p = vW.xz * 0.012 + vec2(uTime * 0.012, uTime * 0.006);
        float n = sFbm(p) * 0.7 + sFbm(p * 2.7 - uTime * 0.01) * 0.3;
        float puff = smoothstep(0.3, 0.75, n);
        // Lit tops, cool shadowed valleys between the billows.
        vec3 col = mix(uColor * vec3(0.72, 0.78, 0.9), uColor * 1.06, puff);
        float d = length(vW.xz - cameraPosition.xz);
        col = mix(col, uFog, smoothstep(uFogFar * 0.35, uFogFar, d));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  seaMat.color = seaU.uColor.value; // the mood system tints it like the old sea
  const cloudSea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1).rotateX(-Math.PI / 2), seaMat);
  cloudSea.position.y = -58;
  scene.add(cloudSea);
  updates.push((dt, t, player) => {
    seaU.uTime.value = t;
    cloudSea.position.x = player.x;
    cloudSea.position.z = player.z;
    seaU.uFogFar.value = scene.fog.far * 2.6;
  });

  // ---------- Cloud banks drifting past, around and below the island ----------
  const puffMat = new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: true });
  const puffs = [];
  for (let i = 0; i < 46; i++) {
    const s = new THREE.Sprite(puffMat);
    // Most drift below the rim; a few sail high and far, so the horizon at eye level stays open.
    const low = i % 4 !== 0;
    const a = Math.random() * Math.PI * 2;
    const r = low ? islandR + 18 + Math.random() * 190 : islandR + 110 + Math.random() * 120;
    const w = low ? 40 + Math.random() * 50 : 30 + Math.random() * 30;
    s.scale.set(w, w * 0.42, 1);
    s.userData = { a, r, y: low ? -48 + Math.random() * 26 : 26 + Math.random() * 22, speed: (0.004 + Math.random() * 0.01) * (i % 2 ? 1 : -1) };
    scene.add(s);
    puffs.push(s);
  }
  updates.push((dt) => puffs.forEach((s) => {
    const u = s.userData;
    u.a += u.speed * dt;
    s.position.set(C.x + Math.cos(u.a) * u.r, u.y, C.z + Math.sin(u.a) * u.r);
  }));

  // ---------- Floating islets ----------
  const grassMat = new THREE.MeshStandardMaterial({ color: '#7fb46a', roughness: 0.9, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7a4a', roughness: 0.9, flatShading: true });
  const islets = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const r = 4 + (i % 3) * 2.5;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1.2, 14), grassMat);
    const rock = new THREE.Mesh(rockCone(r * 0.95, r * 2.6, 12, i * 3.1), under.material);
    rock.position.y = -0.6 - r * 1.3;
    g.add(top, rock);
    if (i % 2 === 0) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 6), rootMat);
      trunk.position.y = 1.6;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), leafMat);
      crown.position.y = 3.2;
      g.add(trunk, crown);
    }
    const a = (i / 7) * Math.PI * 2 + 0.4;
    g.userData = { a, r: islandR + 30 + (i % 3) * 22, y: -12 + (i % 4) * 9, phase: i * 1.7 };
    scene.add(g);
    islets.push(g);
  }
  updates.push((dt, t) => islets.forEach((g) => {
    const u = g.userData;
    u.a += dt * 0.006;
    g.position.set(C.x + Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.4 + u.phase) * 1.2, C.z + Math.sin(u.a) * u.r);
    g.rotation.y = t * 0.02 + u.phase;
  }));

  // ---------- Airplanes ----------
  const planes = [];
  const trailMat = new THREE.SpriteMaterial({ map: puffMat.map, transparent: true, depthWrite: false, opacity: 0.5 });
  let cooldown = 6;
  let farTimer = 30;
  let noise = null;
  const whoosh = (dist) => {
    if (!ctx.soundOn()) return;
    const ac = ctx.getAudio();
    if (!noise) {
      noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) d[i] = last = last * 0.7 + (Math.random() * 2 - 1) * 0.3;
    }
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = ac.createGain();
    const now = ac.currentTime;
    const peak = 0.22 * Math.min(1, 40 / dist);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 3.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 9);
    lp.frequency.setValueAtTime(380, now);
    lp.frequency.linearRampToValueAtTime(900, now + 3.5); // pitch rises as it approaches, falls after
    lp.frequency.linearRampToValueAtTime(260, now + 9);
    src.connect(lp).connect(g).connect(ac.destination);
    src.start(now);
    src.stop(now + 9.2);
  };
  const launch = (player, near) => {
    const plane = makePlane();
    // Fly a straight line that passes beside the island near the player (or far away, high up).
    const a = Math.atan2(player.z - C.z, player.x - C.x);
    const side = near ? islandR + 18 + Math.random() * 18 : islandR + 140;
    const center = new THREE.Vector3(C.x + Math.cos(a) * side, near ? -6 + Math.random() * 16 : 70, C.z + Math.sin(a) * side);
    const dir = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    const start = center.clone().addScaledVector(dir, -260);
    plane.position.copy(start);
    plane.lookAt(start.clone().add(dir));
    plane.rotateY(-Math.PI / 2); // model's nose is +x
    plane.scale.setScalar(near ? 1 : 1.6);
    scene.add(plane);
    planes.push({ plane, dir, speed: near ? 34 : 50, life: 520 / (near ? 34 : 50), trail: [], trailT: 0 });
    if (near) whoosh(side - Math.hypot(player.x - C.x, player.z - C.z));
  };
  updates.push((dt, t, player) => {
    const fromEdge = islandR - Math.hypot(player.x - C.x, player.z - C.z);
    cooldown -= dt;
    farTimer -= dt;
    if (ctx.started() && fromEdge < 16 && cooldown < 0) {
      launch(player, true);
      cooldown = 22 + Math.random() * 16;
    }
    if (farTimer < 0) {
      launch(player, false);
      farTimer = 70 + Math.random() * 60;
    }
    for (let i = planes.length - 1; i >= 0; i--) {
      const p = planes[i];
      p.plane.position.addScaledVector(p.dir, p.speed * dt);
      p.plane.userData.strobe.visible = Math.sin(t * 9) > 0.85;
      p.life -= dt;
      // Contrail puffs from both engines that spread and fade.
      p.trailT -= dt;
      if (p.trailT < 0) {
        p.trailT = 0.08;
        p.plane.userData.engines.forEach((e) => {
          const s = new THREE.Sprite(trailMat.clone());
          e.getWorldPosition(s.position);
          s.scale.set(1.2, 0.8, 1);
          s.userData.age = 0;
          scene.add(s);
          p.trail.push(s);
        });
      }
      p.trail = p.trail.filter((s) => {
        s.userData.age += dt;
        const k = s.userData.age / 3.5;
        s.scale.set(1.2 + k * 7, 0.8 + k * 3, 1);
        s.material.opacity = 0.45 * (1 - k);
        if (k >= 1) {
          scene.remove(s);
          s.material.dispose();
          return false;
        }
        return true;
      });
      if (p.life < 0 && !p.trail.length) {
        scene.remove(p.plane);
        planes.splice(i, 1);
      } else if (p.life < 0) p.plane.visible = false;
    }
  });

  return {
    sea: cloudSea,
    // Move to another island (cloudSea false for the beach world, which has its own ocean).
    setCenter(x, z, r, showClouds = true) {
      C.set(x, 0, z);
      islandR = r;
      cloudSea.visible = showClouds;
      puffs.forEach((p) => (p.visible = showClouds));
    },
    // Clouds follow the mood's tint (sunset peach, night blue...).
    update(dt, t, player) {
      updates.forEach((fn) => fn(dt, t, player));
      puffMat.color.copy(seaU.uColor.value).lerp(scene.fog.color, 0.25);
      trailMat.color.copy(puffMat.color);
    },
  };
}
