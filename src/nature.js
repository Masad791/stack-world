import * as THREE from 'three';
import { ZONES, ARENA, GROVE } from './data.js';

// Four moods the player can cycle through. Everything here is cross-faded, never switched.
export const MOODS = {
  morning: {
    label: 'Morning', skyTop: '#5eb4ff', skyBottom: '#d9f1ff', sunGlow: '#fff6d8', fog: '#cfeaff', fogNear: 70, fogFar: 160,
    hemiSky: '#dff1ff', hemiGround: '#6f9e4f', hemi: 1.4, sun: '#fff4e0', sunI: 2.4, sunPos: [25, 40, 12],
    sea: '#5cc8f0', grass: '#8fcf6a', lamps: 0, fireflies: 0, petals: 0, bloom: 0.25, exposure: 1,
  },
  golden: {
    label: 'Golden hour', skyTop: '#ff9e7a', skyBottom: '#ffe2a8', sunGlow: '#ffd27a', fog: '#ffd9b0', fogNear: 55, fogFar: 140,
    hemiSky: '#ffd6b0', hemiGround: '#7a6a3a', hemi: 1.1, sun: '#ffb46b', sunI: 2.8, sunPos: [40, 14, -10],
    sea: '#f2a97a', grass: '#b8c95a', lamps: 1.2, fireflies: 0.2, petals: 0, bloom: 0.45, exposure: 1.05,
  },
  night: {
    label: 'Starry night', skyTop: '#0b1640', skyBottom: '#2a3b78', sunGlow: '#9fb6ff', fog: '#1d2b5c', fogNear: 45, fogFar: 125,
    hemiSky: '#5a6fb8', hemiGround: '#1a2a3a', hemi: 0.75, sun: '#b9c8ff', sunI: 0.9, sunPos: [-20, 35, 25],
    sea: '#1d3a7a', grass: '#3f6f5a', lamps: 3.2, fireflies: 1, petals: 0, bloom: 1.05, exposure: 0.95,
  },
  sakura: {
    label: 'Sakura', skyTop: '#9fc4ff', skyBottom: '#ffe3ee', sunGlow: '#ffffff', fog: '#ffe1ec', fogNear: 60, fogFar: 150,
    hemiSky: '#ffe6f0', hemiGround: '#7f9e6a', hemi: 1.35, sun: '#fff0f5', sunI: 2.2, sunPos: [20, 38, 20],
    sea: '#8fd3f5', grass: '#9fd47a', lamps: 0, fireflies: 0, petals: 1, bloom: 0.3, exposure: 1,
  },
};
export const MOOD_ORDER = ['morning', 'golden', 'night', 'sakura'];

const COLOR_KEYS = ['skyTop', 'skyBottom', 'sunGlow', 'fog', 'hemiSky', 'hemiGround', 'sun', 'sea', 'grass'];
const NUM_KEYS = ['fogNear', 'fogFar', 'hemi', 'sunI', 'lamps', 'fireflies', 'petals', 'bloom', 'exposure'];

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

  // ---------- Fireflies (night) and petals (sakura) ----------
  const FLY = 160;
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(FLY * 3);
  const flySeed = Array.from({ length: FLY }, () => ({ x: (Math.random() - 0.5) * 120, z: (Math.random() - 0.5) * 120, y: 0.6 + Math.random() * 3, p: Math.random() * 6 }));
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: '#fff3a0', size: 0.9, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(flies);

  const PETALS = 260;
  const petalGeo = new THREE.PlaneGeometry(0.28, 0.2);
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: '#ffb7cf', side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), PETALS);
  const petalSeed = Array.from({ length: PETALS }, () => ({ x: (Math.random() - 0.5) * 100, y: Math.random() * 25, z: (Math.random() - 0.5) * 100, s: 0.6 + Math.random(), p: Math.random() * 6 }));
  petals.visible = false;
  scene.add(petals);

  // ---------- Moods ----------
  let target = MOODS.morning;
  const cur = moodState(target);
  const tmp = new THREE.Color();
  const sunTarget = new THREE.Vector3();
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
    stars.material.opacity = Math.max(0, cur.fireflies - 0.3) * 1.3;
    petals.visible = cur.petals > 0.05;
    petals.material.opacity = cur.petals;
    if (ctx.bloom) ctx.bloom.strength = cur.bloom;
    ctx.renderer.toneMappingExposure = cur.exposure;
  };
  apply();

  return {
    get sunOffset() {
      return cur.sunPos;
    },
    setMood(name) {
      target = MOODS[name];
    },
    update(dt, t, player) {
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

      if (cur.fireflies > 0.02) {
        flySeed.forEach((f, i) => {
          flyPos[i * 3] = player.x + f.x + Math.sin(t * 0.6 + f.p) * 2;
          flyPos[i * 3 + 1] = f.y + Math.sin(t * 1.3 + f.p * 2) * 0.6;
          flyPos[i * 3 + 2] = player.z + f.z + Math.cos(t * 0.5 + f.p) * 2;
        });
        flyGeo.attributes.position.needsUpdate = true;
        flies.material.size = 0.85 + Math.sin(t * 3) * 0.2;
      }
      if (petals.visible) {
        petalSeed.forEach((p, i) => {
          p.y -= dt * 1.4 * p.s;
          if (p.y < 0) p.y = 25;
          const x = player.x + p.x + Math.sin(t * 0.8 + p.p) * 2.5;
          const z = player.z + p.z + Math.cos(t * 0.6 + p.p) * 2;
          q.setFromEuler(new THREE.Euler(t * 2 + p.p, t * 1.3 + p.p, t + p.p));
          m.compose(new THREE.Vector3(x, p.y, z), q, new THREE.Vector3(p.s, p.s, p.s));
          petals.setMatrixAt(i, m);
        });
        petals.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
