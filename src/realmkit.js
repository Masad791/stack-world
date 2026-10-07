import * as THREE from 'three';
import { NOISE } from './sky.js';
import { textCanvas } from './world.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared pieces for the other worlds: floating-island base, ground, gates, labels, info spots.

export function paint(w, h, fn, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

// A floating island: top disc (ground), a soil lip, and a craggy rock root hanging below with layered
// strata, smooth-shaded so it reads as real stone rather than polygons.
export function floatingBase(parent, r, groundMat, rockColors, lip = '#6e563e') {
  const top = new THREE.Mesh(new THREE.CircleGeometry(r, 96).rotateX(-Math.PI / 2), groundMat);
  top.receiveShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 1, 4, 96, 3, true), std(lip, { roughness: 1 }));
  band.position.y = -2;
  const depth = 52;
  let geo = new THREE.CylinderGeometry(r + 1, (r + 1) * 0.05, depth, 96, 40);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  const cols = [];
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (depth / 2 - y) / depth; // 0 top .. 1 tip
    if (k > 0.01) {
      const n = ridged(x * 0.06, y * 0.12, z * 0.06, 5); // crags, stretched into horizontal ledges
      const s = 1 + (n - 0.45) * 0.4 * Math.min(1, k * 4) - Math.pow(k, 1.6) * 0.15;
      p.setX(i, x * s);
      p.setZ(i, z * s);
      p.setY(i, y + (noise3(x * 0.05, 0, z * 0.05) - 0.5) * depth * 0.12 * k);
    }
    const band = Math.min(rockColors.length - 1, Math.floor((k + (noise3(x * 0.04, y * 0.3, z * 0.04) - 0.5) * 0.15) * rockColors.length));
    c.set(rockColors[Math.max(0, band)]).multiplyScalar(0.85 + 0.25 * noise3(x * 0.2, y * 0.6, z * 0.2));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  rock.position.y = -4 - depth / 2;
  parent.add(top, band, rock);
  return top;
}

export function label(text, color = '#1b1b1f', w = 9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(text, { fg: color }), depthWrite: false }));
  s.scale.set(w, w / 4, 1);
  return s;
}

// The Sky Gate: two stone pillars, a lintel, and a swirling cloud portal between them.
const portalU = { uTime: { value: 0 } };
const portalMat = new THREE.ShaderMaterial({
  uniforms: portalU,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uTime; varying vec2 vUv; ${NOISE}
    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p * vec2(1.0, 0.62));
      float a = atan(p.y, p.x);
      float swirl = sFbm(vec2(a * 1.5 + uTime * 0.6 + r * 6.0, r * 5.0 - uTime * 0.8));
      vec3 col = mix(vec3(0.55, 0.75, 1.0), vec3(1.0, 0.97, 0.9), swirl);
      col += vec3(0.25, 0.35, 0.6) * (1.0 - smoothstep(0.0, 0.5, r));
      float edge = 1.0 - smoothstep(0.42, 0.5, r);
      gl_FragColor = vec4(col, edge * (0.65 + swirl * 0.35));
    }`,
});
export function makeGate(parent, x, z, angle, title = 'Sky Gate') {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  const stone = std('#d8d2c4', { flatShading: true });
  const dark = std('#a39a8a', { flatShading: true });
  [-2.4, 2.4].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), stone);
    pillar.position.set(px, 3, 0);
    pillar.castShadow = true;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), dark);
    foot.position.set(px, 0.25, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), dark);
    cap.position.set(px, 6.2, 0);
    g.add(pillar, foot, cap);
  });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.8, 1.2), stone);
  lintel.position.y = 6.7;
  lintel.castShadow = true;
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 5.8), portalMat);
  portal.position.y = 3.1;
  const sign = label(title, '#2f6fe4', 6);
  sign.position.y = 8.4;
  g.add(lintel, portal, sign);
  parent.add(g);
  // The spot in front of the gate where the travel prompt appears.
  const front = new THREE.Vector3(0, 0, 2.6).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
  return { group: g, spot: { x: x + front.x, z: z + front.z }, pillars: [-2.4, 2.4].map((px) => new THREE.Vector3(px, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle).add(new THREE.Vector3(x, 0, z))) };
}
export function tickGates(t) {
  portalU.uTime.value = t;
}

// Speech bubble sprite that floats above someone.
export function bubbleSprite(texture, width = 9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.set(width, width * 0.36, 1);
  s.renderOrder = 2;
  return s;
}

// Smooth 3D value noise and a ridged variant (sharp crests, soft valleys) for terrain and rocks.
const h3 = (x, y, z) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}
export function ridged(x, y, z, octaves = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * f, y * f, z * f) * 2 - 1);
    s += n * n * a;
    a *= 0.5;
    f *= 2.03;
  }
  return s;
}

const ROCK_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
// A natural boulder: a lumpy, smooth-shaded rock with lichen/dirt variation and, optionally, snow
// settled on its upward-facing surfaces.
export function rock(size, seed, { color = '#8a857e', dark = '#5e5954', snow = 0, flat = 0.75 } = {}) {
  let geo = new THREE.IcosahedronGeometry(size, 3);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x / size * 1.3 + seed, v.y / size * 1.3, v.z / size * 1.3) * 0.45 + ridged(v.x / size * 2.6 + seed, v.y / size * 2.6, v.z / size * 2.6, 3) * 0.35;
    v.multiplyScalar(0.8 + n * 0.5);
    v.y *= flat;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const a = new THREE.Color(color), b = new THREE.Color(dark), w = new THREE.Color('#f2f5f9'), c = new THREE.Color();
  const cols = [];
  for (let i = 0; i < p.count; i++) {
    c.copy(a).lerp(b, noise3(p.getX(i) * 3 + seed, p.getY(i) * 3, p.getZ(i) * 3));
    if (snow && nrm.getY(i) > 0.55 - snow * 0.2) c.lerp(w, Math.min(1, (nrm.getY(i) - 0.45) * 3));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.translate(0, size * flat * 0.45, 0);
  const m = new THREE.Mesh(geo, ROCK_MAT); // one shared material, so all rocks batch together
  m.castShadow = m.receiveShadow = true;
  return m;
}
