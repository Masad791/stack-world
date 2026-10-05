import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ZONES, PROJECTS, ORBS } from './data.js';

export const ISLAND_R = 76;

// Tiny seeded RNG so trees land in the same place on every visit.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mats = new Map();
const mat = (color, extra = {}) => {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }));
  return mats.get(key);
};

// Text on a canvas, used for zone labels, billboards' name plates and the JS cube.
export function textCanvas(text, { w = 512, h = 128, bg = '#ffffff', fg = '#1b1b1f', font = 600, size = 54, radius = 64 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, radius);
    g.fill();
  }
  g.fillStyle = fg;
  g.font = `${font} ${size}px "Space Grotesk", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// devicon SVGs have only a viewBox; give them a size so every browser can rasterize them.
async function logoTexture(file) {
  const svg = (await (await fetch(`/logos/${file}.svg`)).text()).replace('<svg', '<svg width="256" height="256"');
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(160, 160, 158, 0, Math.PI * 2);
  g.fill();
  g.drawImage(img, 52, 52, 216, 216);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene) {
  const colliders = []; // { x, z, r }
  const animated = []; // (t, dt) => void
  const billboards = []; // { project, x, z }
  const rand = rng(7);

  const add = (mesh, x = 0, y = 0, z = 0, { cast = true, receive = false, parent = scene } = {}) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  };
  const box = (w, h, d, color, x, y, z, o) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)), x, y, z, o);
  const rbox = (w, h, d, color, x, y, z, o) => add(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.2), mat(color)), x, y, z, o);
  const cyl = (rt, rb, h, color, x, y, z, seg = 16, o) => add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)), x, y, z, o);
  const ball = (r, color, x, y, z, o) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color)), x, y, z, o);
  const col = (x, z, r) => colliders.push({ x, z, r });
  const wall = (x1, z1, x2, z2, r = 0.9) => {
    const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / r);
    for (let i = 0; i <= n; i++) col(x1 + ((x2 - x1) * i) / n, z1 + ((z2 - z1) * i) / n, r);
  };
  const label = (text, x, y, z, color = '#1b1b1f') => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(text, { fg: color }), depthWrite: false }));
    sprite.scale.set(9, 2.25, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
    return sprite;
  };

  // ---------- Island, beach and sea ----------
  add(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 3, 4, 72), mat('#8fcf6a')), 0, -2, 0, { cast: false, receive: true });
  add(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R + 4, ISLAND_R + 2, 3.6, 72), mat('#f2dfae')), 0, -2.25, 0, { cast: false, receive: true });
  const sea = add(new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: '#5cc8f0', roughness: 0.3, metalness: 0.1 })), 0, -1.1, 0, { cast: false });
  sea.rotation.x = -Math.PI / 2;
  animated.push((t) => (sea.position.y = -1.1 + Math.sin(t * 0.8) * 0.08));

  // Paths from the plaza to every district.
  ZONES.filter((zn) => zn.id !== 'plaza').forEach((zn) => {
    const len = Math.hypot(zn.x, zn.z);
    const path = add(new THREE.Mesh(new THREE.PlaneGeometry(5, len), mat('#ead7a4')), zn.x / 2, 0.02, zn.z / 2, { cast: false, receive: true });
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = Math.atan2(zn.x, zn.z);
  });
  const nearPath = (x, z) =>
    ZONES.some((zn) => {
      const len2 = zn.x * zn.x + zn.z * zn.z || 1;
      const t = Math.max(0, Math.min(1, (x * zn.x + z * zn.z) / len2));
      return Math.hypot(x - zn.x * t, z - zn.z * t) < 4.5;
    });

  // District pads and floating name labels.
  ZONES.forEach((zn) => {
    cyl(zn.r + 0.7, zn.r + 0.7, 0.06, '#e6dcc8', zn.x, 0.03, zn.z, 48, { cast: false, receive: true });
    cyl(zn.r, zn.r, 0.08, '#f7f1e5', zn.x, 0.05, zn.z, 48, { cast: false, receive: true });
    zn.label = label(zn.name, zn.x, zn.id === 'hire' ? 15 : 11, zn.z, zn.color);
  });

  // ---------- Welcome Plaza: fountain + signposts ----------
  cyl(4.2, 4.6, 0.9, '#cfc6b8', 0, 0.45, 0);
  const water = cyl(3.7, 3.7, 0.2, '#6fd3f7', 0, 0.85, 0, 32, { cast: false });
  cyl(0.6, 0.8, 2.6, '#cfc6b8', 0, 1.3, 0);
  const mad = new THREE.Mesh(new RoundedBoxGeometry(3.2, 1.3, 1.3, 3, 0.25), [
    mat('#1b1b1f'), mat('#1b1b1f'), mat('#1b1b1f'), mat('#1b1b1f'),
    new THREE.MeshStandardMaterial({ map: textCanvas('MAD', { w: 256, h: 128, bg: '#1b1b1f', fg: '#ff4a1c', size: 84, font: 700, radius: 8 }) }),
    new THREE.MeshStandardMaterial({ map: textCanvas('MAD', { w: 256, h: 128, bg: '#1b1b1f', fg: '#ff4a1c', size: 84, font: 700, radius: 8 }) }),
  ]);
  add(mad, 0, 4.2, 0);
  animated.push((t) => {
    mad.rotation.y = t * 0.6;
    mad.position.y = 4.2 + Math.sin(t * 1.5) * 0.25;
    water.scale.setScalar(1 + Math.sin(t * 2) * 0.01);
  });
  col(0, 0, 4.6);
  ZONES.filter((zn) => zn.id !== 'plaza').forEach((zn, i) => {
    const a = Math.atan2(zn.x, zn.z);
    const px = Math.sin(a) * 7.2;
    const pz = Math.cos(a) * 7.2;
    cyl(0.12, 0.12, 2.4, '#8a6a4a', px, 1.2, pz, 8);
    const sign = add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.12), [
      mat('#8a6a4a'), mat('#8a6a4a'), mat('#8a6a4a'), mat('#8a6a4a'),
      new THREE.MeshStandardMaterial({ map: textCanvas(zn.name, { w: 512, h: 112, bg: '#fff8ea', size: 46, radius: 12 }) }),
      new THREE.MeshStandardMaterial({ map: textCanvas(zn.name, { w: 512, h: 112, bg: '#fff8ea', size: 46, radius: 12 }) }),
    ]), px, 2.1 + (i % 2) * 0.05, pz);
    sign.rotation.y = a + Math.PI / 2;
    col(px, pz, 0.4);
  });

  // ---------- Backend Castle (Laravel red) + PHP elephant ----------
  {
    const { x: cx, z: cz } = ZONES[1];
    const red = '#e3342f';
    [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([dx, dz]) => {
      cyl(1.6, 1.8, 7, red, cx + dx, 3.5, cz + dz, 12);
      add(new THREE.Mesh(new THREE.ConeGeometry(2.3, 3, 12), mat('#9b1c1c')), cx + dx, 8.5, cz + dz);
      col(cx + dx, cz + dz, 2);
    });
    box(10, 4, 1, red, cx, 2, cz - 5);
    wall(cx - 5, cz - 5, cx + 5, cz - 5);
    box(1, 4, 10, red, cx - 5, 2, cz);
    wall(cx - 5, cz - 5, cx - 5, cz + 5);
    box(1, 4, 10, red, cx + 5, 2, cz);
    wall(cx + 5, cz - 5, cx + 5, cz + 5);
    box(3, 4, 1, red, cx - 3.5, 2, cz + 5); // gate side faces the plaza
    box(3, 4, 1, red, cx + 3.5, 2, cz + 5);
    wall(cx - 5, cz + 5, cx - 2, cz + 5);
    wall(cx + 2, cz + 5, cx + 5, cz + 5);
    box(4.2, 1.2, 1.2, '#9b1c1c', cx, 4.6, cz + 5); // arch over the gate
    const keep = rbox(3.6, 6, 3.6, '#c53030', cx, 3, cz - 1.2);
    col(cx, cz - 1.2, 2.6);
    logoTexture('laravel').then((map) => {
      const plate = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map, transparent: true })), cx, 4, cz + 0.62, { cast: false });
      plate.userData.keep = keep;
    });

    // PHP elephant, the language's mascot, grazing beside the castle.
    const ex = cx + 9;
    const ez = cz - 6;
    const purple = '#7a7fc2';
    const body = ball(1.9, purple, ex, 2.4, ez);
    body.scale.set(1.25, 1, 0.95);
    ball(1.15, purple, ex + 2.1, 3.1, ez).scale.set(1, 1, 0.95);
    [[-0.7, 1], [0.7, 1]].forEach(([dz]) => {
      const ear = ball(0.9, '#9a9ee0', ex + 1.7, 3.3, ez + dz * 1.1);
      ear.scale.set(0.35, 1, 1);
    });
    const trunk = cyl(0.32, 0.22, 2, purple, ex + 3, 2.1, ez, 10);
    trunk.rotation.z = 0.35;
    [[-0.9, -0.7], [-0.9, 0.7], [0.9, -0.7], [0.9, 0.7]].forEach(([dx, dz]) => cyl(0.45, 0.45, 1.6, purple, ex + dx, 0.8, ez + dz, 10));
    [[-0.45], [0.45]].forEach(([dz]) => ball(0.12, '#1b1b1f', ex + 2.9, 3.4, ez + dz));
    col(ex, ez, 2.4);
    col(ex + 2.4, ez, 1.3);
  }

  // ---------- Frontend Garden ----------
  {
    const { x: cx, z: cz } = ZONES[2];
    cyl(1.4, 1.8, 2, '#e8e2d6', cx, 1, cz);
    const nucleus = ball(0.75, '#61dafb', cx, 4.6, cz);
    nucleus.material = mat('#61dafb', { emissive: '#61dafb', emissiveIntensity: 0.6 });
    const atom = new THREE.Group();
    [0, Math.PI / 3, -Math.PI / 3].forEach((rz) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.13, 8, 48), mat('#61dafb', { emissive: '#1b6f88', emissiveIntensity: 0.5 }));
      ring.rotation.set(Math.PI / 2, 0, rz);
      ring.scale.y = 0.38;
      ring.castShadow = true;
      atom.add(ring);
    });
    add(atom, cx, 4.6, cz);
    animated.push((t) => (atom.rotation.y = t * 0.8));
    col(cx, cz, 2);

    // Vue "V" monument.
    const vx = cx - 6.5;
    const vz = cz + 4;
    [[-1, '#41b883', 1], [1, '#41b883', 1]].forEach(([s, c]) => {
      const arm = box(1.3, 5.5, 1, c, vx + s * 1.25, 2.6, vz);
      arm.rotation.z = -s * 0.42; // tops lean outward into a V
    });
    [[-1], [1]].forEach(([s]) => {
      const arm = box(0.7, 3.6, 1.1, '#35495e', vx + s * 0.7, 2.6, vz + 0.1);
      arm.rotation.z = -s * 0.42;
    });
    col(vx, vz, 2.4);

    // Giant floating JavaScript cube.
    const jsTex = textCanvas('JS', { w: 256, h: 256, bg: '#f7df1e', fg: '#1b1b1f', size: 120, font: 700, radius: 0 });
    const js = add(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshStandardMaterial({ map: jsTex })), cx + 6.5, 2.6, cz + 4);
    animated.push((t) => {
      js.rotation.y = t * 0.5;
      js.position.y = 2.6 + Math.sin(t * 1.4) * 0.35;
    });
    col(cx + 6.5, cz + 4, 2.3);

    // Three.js: a wireframe tetrahedron spinning over the hedge.
    const tetra = add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(2.2)), new THREE.LineBasicMaterial({ color: '#1b1b1f' })), cx, 3.4, cz - 7, { cast: false });
    animated.push((t) => tetra.rotation.set(t * 0.4, t * 0.6, 0));
    cyl(1, 1.2, 0.8, '#e8e2d6', cx, 0.4, cz - 7);
    col(cx, cz - 7, 1.4);

    // Flower beds.
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 11 + Math.sin(i * 3.1) * 0.6;
      const colors = ['#ff6b9d', '#ffd166', '#61dafb', '#ffffff', '#c792ea'];
      ball(0.32, colors[i % colors.length], cx + Math.cos(a) * r, 0.35, cz + Math.sin(a) * r, { cast: false });
    }
  }

  // ---------- Data Docks ----------
  {
    const { x: cx, z: cz } = ZONES[3];
    const stack = (x, z, body, top, n = 3) => {
      for (let i = 0; i < n; i++) cyl(2, 2, 1, i === n - 1 ? top : body, x, 0.6 + i * 1.25, z, 24);
      col(x, z, 2.3);
    };
    stack(cx - 5.5, cz - 3, '#336791', '#4f8fc0'); // Postgres
    stack(cx + 5.5, cz - 3, '#00758f', '#f29111'); // MySQL
    [[0, 0, 0], [1.6, 0, 0], [0.8, 0, 1.4], [0.8, 1.4, 0.45]].forEach(([dx, dy, dz]) => rbox(1.5, 1.4, 1.5, '#d82c20', cx - 6 + dx, 0.7 + dy, cz + 4 + dz)); // Redis
    col(cx - 5.2, cz + 4.5, 2.2);
    const leaf = ball(1.2, '#47a248', cx + 5.5, 2.6, cz + 5); // MongoDB leaf
    leaf.scale.set(0.7, 2.1, 0.45);
    cyl(0.12, 0.12, 1.4, '#3b2a1a', cx + 5.5, 0.7, cz + 5, 6);
    col(cx + 5.5, cz + 5, 1.4);

    // Little data packets hopping between the databases.
    const packets = [0, 1, 2, 3].map(() => box(0.4, 0.4, 0.4, '#ffd166', 0, 0, 0, { cast: false }));
    packets.forEach((p) => (p.material = mat('#ffd166', { emissive: '#ffb703', emissiveIntensity: 0.8 })));
    animated.push((t) => {
      packets.forEach((p, i) => {
        const k = (t * 0.35 + i / packets.length) % 1;
        p.position.set(cx - 5.5 + k * 11, 4.4 + Math.sin(k * Math.PI) * 3, cz - 3);
        p.rotation.set(t * 2, t * 3, 0);
      });
    });
  }

  // ---------- AI & Desktop Lab ----------
  {
    const { x: cx, z: cz } = ZONES[4];
    // Docker whale carrying containers.
    const wx = cx - 6;
    const wz = cz + 4;
    const whale = ball(2, '#2496ed', wx, 1.7, wz);
    whale.scale.set(1.7, 0.85, 1.05);
    const tail = add(new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), mat('#2496ed')), wx - 3.6, 2.1, wz);
    tail.rotation.z = Math.PI / 2;
    ball(0.16, '#1b1b1f', wx + 2.3, 2.1, wz + 0.95);
    ['#0db7ed', '#384d54', '#0db7ed', '#384d54', '#0db7ed'].forEach((c, i) => box(0.9, 0.8, 0.9, c, wx - 1.6 + (i % 3) * 1, 3.15 + Math.floor(i / 3) * 0.8, wz));
    col(wx, wz, 3.2);
    col(wx - 3.4, wz, 1);

    // Voice Changer equalizer.
    const bars = [];
    for (let i = 0; i < 9; i++) bars.push(rbox(0.6, 1, 0.6, i % 2 ? '#ff4a1c' : '#ff8a5c', cx - 2.8 + i * 0.7, 0.5, cz - 6));
    animated.push((t) => bars.forEach((b, i) => {
      const h = 1 + Math.abs(Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.3 + i)) * 4;
      b.scale.y = h;
      b.position.y = h / 2;
    }));
    col(cx, cz - 6, 3.4);

    // Node.js hexagon and an Electron atom.
    cyl(1.8, 1.8, 3, '#5fa04e', cx + 6.5, 1.5, cz + 4.5, 6);
    col(cx + 6.5, cz + 4.5, 2);
    const electron = new THREE.Group();
    [0, Math.PI / 3, -Math.PI / 3].forEach((rz) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.09, 6, 40), mat('#47848f'));
      ring.rotation.set(Math.PI / 2, 0, rz);
      ring.scale.y = 0.4;
      electron.add(ring);
    });
    electron.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), mat('#9feaf9')));
    add(electron, cx + 7, 3.4, cz - 4);
    cyl(0.9, 1.1, 1.6, '#e8e2d6', cx + 7, 0.8, cz - 4);
    animated.push((t) => (electron.rotation.y = -t));
    col(cx + 7, cz - 4, 1.3);

    // Python: two friendly snakes (blue and yellow) coiled side by side.
    [['#3776ab', -1], ['#ffd43b', 1]].forEach(([c, s]) => {
      for (let i = 0; i < 8; i++) {
        const k = i / 7;
        ball(0.45 - k * 0.12, c, cx - 1 + s * 1.1 + Math.sin(k * Math.PI * 1.6) * s * 0.6, 0.45 + k * 2.6, cz + 4 + Math.cos(k * Math.PI * 1.6) * 0.5);
      }
    });
    col(cx - 1, cz + 4, 2.2);
  }

  // ---------- Projects Avenue: billboards with real screenshots ----------
  {
    const { x: cx, z: cz } = ZONES[5];
    const loader = new THREE.TextureLoader();
    // The camera always looks from the south-east, so every screen faces it (like buildings in
    // Clash of Clans): two staggered rows of four along the camera's left-right axis.
    const R = new THREE.Vector3(1, 0, -1).normalize();
    const T = new THREE.Vector3(1, 0, 1).normalize();
    PROJECTS.forEach((p, i) => {
      const row = Math.floor(i / 4);
      const colIndex = (i % 4) - 1.5 + (row ? 0.5 : -0.2);
      const x = cx + R.x * colIndex * 7.2 + T.x * (row ? 4 : -5);
      const z = cz + R.z * colIndex * 7.2 + T.z * (row ? 4 : -5);
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = Math.PI / 4; // face the camera
      scene.add(group);
      const post = (px) => add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2, 8), mat('#3a3a40')), px, 1, 0, { parent: group });
      post(-2.2);
      post(2.2);
      add(new THREE.Mesh(new RoundedBoxGeometry(6.4, 4.2, 0.35, 3, 0.12), mat('#1b1b1f')), 0, 4, 0, { parent: group });
      const tex = loader.load(p.img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      add(new THREE.Mesh(new THREE.PlaneGeometry(6, 3.75), new THREE.MeshBasicMaterial({ map: tex })), 0, 4, 0.19, { cast: false, parent: group });
      const plate = add(new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.75), new THREE.MeshBasicMaterial({ map: textCanvas(`${p.num}  ${p.title}`, { w: 640, h: 104, size: 40, radius: 20 }), transparent: true })), 0, 1.45, 0.2, { cast: false, parent: group });
      plate.renderOrder = 1;
      // Colliders across the billboard's width, in world space.
      [-2.2, 0, 2.2].forEach((lx) => {
        const v = new THREE.Vector3(lx, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
        col(x + v.x, z + v.z, 0.9);
      });
      // The reading spot is a few steps in front of the screen.
      const front = new THREE.Vector3(0, 0, 3.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
      billboards.push({ project: p, x: x + front.x, z: z + front.z });
    });
  }

  // ---------- Hire HQ ----------
  {
    const { x: cx, z: cz } = ZONES[6];
    rbox(7, 2, 7, '#f4f2ee', cx, 1, cz);
    rbox(5, 7, 5, '#1b1b1f', cx, 5.5, cz);
    for (let i = 0; i < 3; i++) box(5.1, 0.25, 5.1, '#ff4a1c', cx, 3.4 + i * 1.8, cz);
    cyl(1.4, 2, 1.2, '#f4f2ee', cx, 9.6, cz);
    const beacon = ball(0.8, '#ff4a1c', cx, 10.8, cz);
    beacon.material = mat('#ff4a1c', { emissive: '#ff4a1c', emissiveIntensity: 2 });
    const beam = add(new THREE.Mesh(new THREE.ConeGeometry(2.5, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb199', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })), cx, 10.8, cz, { cast: false });
    beam.geometry.translate(0, -7, 0);
    beam.rotation.z = Math.PI / 2.6;
    const pivot = new THREE.Group();
    pivot.position.set(cx, 0, cz);
    scene.add(pivot);
    beam.position.set(0, 10.8, 0);
    pivot.add(beam);
    animated.push((t) => (pivot.rotation.y = t * 0.9));
    col(cx, cz, 4.4);
    // Mailbox by the door.
    cyl(0.1, 0.1, 1.2, '#3a3a40', cx + 3.5, 0.6, cz + 4.5, 6);
    rbox(0.9, 0.7, 1.2, '#ff4a1c', cx + 3.5, 1.5, cz + 4.5);
    col(cx + 3.5, cz + 4.5, 0.7);
  }

  // ---------- Trees and rocks, kept off districts and paths ----------
  const trees = [];
  for (let tries = 0; trees.length < 85 && tries < 3000; tries++) {
    const a = rand() * Math.PI * 2;
    const r = 12 + Math.sqrt(rand()) * (ISLAND_R - 16);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (ZONES.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.r + 4)) continue;
    if (nearPath(x, z) || trees.some((tr) => Math.hypot(tr.x - x, tr.z - z) < 3.6)) continue;
    trees.push({ x, z });
  }
  const greens = ['#4caf50', '#66bb6a', '#2e7d32', '#81c784'];
  trees.forEach(({ x, z }, i) => {
    if (i % 6 === 5) {
      const rock = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + rand() * 0.8), mat('#a9a9b0')), x, 0.5, z);
      rock.rotation.set(rand() * 3, rand() * 3, 0);
      col(x, z, 1.2);
      return;
    }
    const s = 0.8 + rand() * 0.6;
    cyl(0.25 * s, 0.35 * s, 1.6 * s, '#7a5233', x, 0.8 * s, z, 6);
    const crown = add(new THREE.Mesh(new THREE.ConeGeometry(1.7 * s, 3.6 * s, 7), mat(greens[i % 4])), x, 3.1 * s, z);
    crown.rotation.y = rand() * 3;
    if (i % 2) add(new THREE.Mesh(new THREE.ConeGeometry(1.3 * s, 2.6 * s, 7), mat(greens[(i + 1) % 4])), x, 4.4 * s, z);
    col(x, z, 0.8 * s);
  });

  // ---------- Stack orbs ----------
  const blocked = (x, z, pad) => colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + pad);
  const orbs = ORBS.map(([name, file, ox, oz]) => {
    let x = ox;
    let z = oz;
    // Spiral outward until the orb sits in open space.
    for (let k = 0; blocked(x, z, 1.4) && k < 200; k++) {
      x = ox + Math.cos(k * 0.9) * k * 0.15;
      z = oz + Math.sin(k * 0.9) * k * 0.15;
    }
    const group = new THREE.Group();
    group.position.set(x, 1.6, z);
    group.scale.setScalar(1.4);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 32), mat('#ffffff'));
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    group.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: '#ff4a1c' }));
    group.add(ring);
    logoTexture(file).then((map) => {
      const face = new THREE.MeshBasicMaterial({ map, transparent: true });
      [0.09, -0.09].forEach((zOff, i) => {
        const p = new THREE.Mesh(new THREE.CircleGeometry(0.84, 32), face);
        p.position.z = zOff;
        if (i) p.rotation.y = Math.PI;
        group.add(p);
      });
    });
    scene.add(group);
    return { name, file, group, x, z, taken: false, seed: rand() * 10 };
  });
  animated.push((t) => orbs.forEach((o) => {
    if (o.taken) return;
    o.group.rotation.y = t * 1.6 + o.seed;
    o.group.position.y = 2 + Math.sin(t * 2 + o.seed) * 0.3;
  }));

  return {
    colliders,
    billboards,
    orbs,
    update: (t, dt) => animated.forEach((fn) => fn(t, dt)),
  };
}
