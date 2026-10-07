import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint, rng, std, floatingBase, label, makeGate, noise3, ridged, rock } from './realmkit.js';

// Karakoram Peaks: a snowy plateau high in the sky with K2 on the horizon, the Baltoro Glacier,
// a frozen lake, an expedition base camp and, sometimes, a markhor on the rocks.

const SPOTS = [
  { id: 'k2', x: 0, z: -48, r: 7, kicker: 'Karakoram // Pakistan', title: 'K2, the Savage Mountain',
    text: 'At 8,611 metres, K2 is the second-highest mountain on Earth. Climbers call it the Savage Mountain: it is steeper and more exposed than Everest. It was first climbed in 1954 by the Italians Lino Lacedelli and Achille Compagnoni, and first climbed in winter only in 2021, by a team of ten Nepali climbers.' },
  { id: 'glacier', x: -30, z: -18, r: 7, kicker: 'Karakoram // Ice', title: 'The Baltoro Glacier',
    text: 'About 63 kilometres long, it is one of the longest glaciers outside the polar regions. It leads to Concordia, one of the few places on Earth where you can see four 8,000-metre peaks at once: K2, Broad Peak, and Gasherbrum I and II.' },
  { id: 'camp', x: 18, z: 18, r: 7, kicker: 'Karakoram // Base camp', title: 'Life at base camp',
    text: 'Expeditions spend weeks at base camp letting their bodies adjust to the altitude. At 5,000 metres each breath holds only about half the oxygen it would at sea level, so climbers move up and down the mountain slowly to acclimatise.' },
];
export const MARKHOR = {
  name: 'Markhor', latin: 'Capra falconeri', status: 'Near Threatened',
  text: 'Pakistan\'s national animal: a wild goat of the Karakoram and Hindu Kush. Males grow spiralling, corkscrew horns that can be longer than a metre. Community conservation in Gilgit-Baltistan, funded partly by tightly controlled trophy hunting, helped its numbers recover, and in 2015 it was moved from Endangered to Near Threatened.',
};

// A Karakoram massif: a concave granite pyramid carved by ridged noise into sharp aretes and
// gullies. Snow only holds where the face is gentle enough; the steep walls stay dark rock, which is
// what makes the real peaks look so dramatic.
function mountain(radius, height, seed, snowLine = 0.45, faces = 4) {
  let geo = new THREE.ConeGeometry(radius, height, 128, 80, true);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = (y + height / 2) / height; // 0 base .. 1 summit
    const a = Math.atan2(z, x);
    // Concave profile (wide base, steep upper pyramid) plus a few main ridges.
    const prof = Math.pow(1 - k, 1.35) / Math.max(1e-4, 1 - k);
    const ridges = 1 + 0.16 * Math.cos(faces * a + seed) * (1 - k * 0.5);
    const n = ridged(x * 0.022 + seed, y * 0.022, z * 0.022, 5);
    const gully = ridged(x * 0.09 + seed, y * 0.025, z * 0.09, 4); // vertical couloirs and buttresses
    const r = prof * ridges * (0.74 + n * 0.45 + gully * 0.28);
    p.setX(i, x * r);
    p.setZ(i, z * r);
    p.setY(i, y + (n - 0.5) * height * 0.06 * (1 - k));
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const cols = [];
  const c = new THREE.Color();
  const rockA = new THREE.Color('#4d4844');
  const rockB = new THREE.Color('#7b736b');
  const snow = new THREE.Color('#f4f7fb');
  const snowShade = new THREE.Color('#c9d6e6');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = (y + height / 2) / height;
    const flat = nrm.getY(i);
    c.copy(rockA).lerp(rockB, noise3(p.getX(i) * 0.08 + seed, y * 0.08, p.getZ(i) * 0.08));
    // Snow: more of it higher up, but only on faces gentle enough to hold it.
    const line = snowLine + (noise3(p.getX(i) * 0.05, y * 0.05, p.getZ(i) * 0.05 + seed) - 0.5) * 0.25;
    const hold = THREE.MathUtils.smoothstep(flat, 0.42 - (k - line) * 0.25, 0.62 - (k - line) * 0.25);
    const cover = THREE.MathUtils.smoothstep(k, line - 0.05, line + 0.08) * hold;
    c.lerp(snowShade.clone().lerp(snow, THREE.MathUtils.clamp(flat * 1.4, 0, 1)), cover);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }));
}

function markhor() {
  const g = new THREE.Group();
  const coat = std('#b39470', { roughness: 0.95 });
  const pale = std('#e2d6c0', { roughness: 0.95 });
  const dark = std('#4a3a2c', { roughness: 0.9 });
  const ell = (rx, ry, rz, m) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m);
    mesh.scale.set(rx, ry, rz);
    mesh.castShadow = true;
    return mesh;
  };
  const body = ell(0.42, 0.45, 0.9, coat);
  body.position.y = 1.35;
  const belly = ell(0.36, 0.3, 0.7, pale);
  belly.position.y = 1.18;
  // The shaggy neck ruff of a male markhor.
  const ruff = ell(0.36, 0.55, 0.32, pale);
  ruff.position.set(0, 1.3, 0.75);
  g.add(body, belly, ruff);
  [[-0.24, 0.6], [0.24, 0.6], [-0.24, -0.6], [0.24, -0.6]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.9, 4, 8), coat);
    leg.position.set(x, 0.55, z);
    leg.castShadow = true;
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8), dark);
    hoof.position.set(x, 0.06, z);
    g.add(leg, hoof);
  });
  const head = new THREE.Group();
  head.position.set(0, 1.85, 1.05);
  const skull = ell(0.17, 0.2, 0.35, coat);
  skull.rotation.x = 0.5;
  const muzzle = ell(0.12, 0.12, 0.16, dark);
  muzzle.position.set(0, -0.15, 0.27);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), pale);
  beard.rotation.x = Math.PI;
  beard.position.set(0, -0.35, 0.18);
  head.add(skull, muzzle, beard);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std('#2a1d10', { roughness: 0.2 }));
    eye.position.set(s * 0.13, 0.06, 0.12);
    const ear = ell(0.05, 0.13, 0.04, coat);
    ear.position.set(s * 0.18, 0.12, -0.08);
    ear.rotation.z = s * 1.0;
    // Corkscrew horns: a tube along a helix that rises and flares outward.
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const k = i / 40;
      const a = k * Math.PI * 5 * s;
      const r = 0.06 + k * 0.12;
      pts.push(new THREE.Vector3(s * (0.08 + k * 0.35) + Math.cos(a) * r, 0.15 + k * 1.15, -0.05 - k * 0.25 + Math.sin(a) * r));
    }
    const horn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.045, 6), std('#5b4a38', { roughness: 0.6 }));
    horn.castShadow = true;
    head.add(eye, ear, horn);
  });
  const tail = ell(0.06, 0.06, 0.14, dark);
  tail.position.set(0, 1.55, -0.95);
  g.add(head, tail);
  return { group: g, head };
}

// A yak: massive shoulders, a long shaggy skirt of hair, upswept horns and a bushy tail.
function yak(i) {
  const g = new THREE.Group();
  const coat = std(i ? '#3a2e26' : '#2a2320', { roughness: 1 });
  const pale = std('#e9e2d6', { roughness: 1 });
  const ell = (rx, ry, rz, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m);
    mesh.scale.set(rx, ry, rz);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  ell(0.75, 0.75, 1.3, coat, 0, 1.45, 0);
  ell(0.7, 0.85, 0.6, coat, 0, 1.65, 0.65); // shoulder hump
  // Hair skirt hanging to the knees.
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.95, 0.9, 20, 1, true), std(i ? '#3a2e26' : '#2a2320', { roughness: 1, side: THREE.DoubleSide }));
  skirt.scale.z = 1.6;
  skirt.position.y = 0.95;
  skirt.castShadow = true;
  g.add(skirt);
  [[-0.38, 0.75], [0.38, 0.75], [-0.38, -0.75], [0.38, -0.75]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.7, 4, 8), coat);
    leg.position.set(x, 0.45, z);
    g.add(leg);
  });
  const head = new THREE.Group();
  head.position.set(0, 1.55, 1.25);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), i ? pale : coat);
  skull.scale.set(1, 1, 1.5);
  skull.position.set(0, -0.2, 0.3);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), std('#1e1a18'));
  muzzle.position.set(0, -0.35, 0.72);
  head.add(skull, muzzle);
  [-1, 1].forEach((s) => {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      pts.push(new THREE.Vector3(s * (0.25 + Math.sin(f * 1.6) * 0.4), -0.05 + f * f * 0.45, 0.2 - f * 0.1));
    }
    const horn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.05, 6), std('#d8cfc0', { roughness: 0.5 }));
    head.add(horn);
  });
  const tail = new THREE.Group();
  tail.position.set(0, 1.6, -1.25);
  const brush = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.7, 4, 8), i ? pale : coat);
  brush.position.y = -0.45;
  tail.add(brush);
  g.add(head, tail);
  return { group: g, head, tail };
}

export function buildPeaks({ scene, origin, addCollider }) {
  const R = 64;
  const root = new THREE.Group();
  root.position.set(origin.x, 0, origin.z);
  scene.add(root);
  const col = (x, z, r) => addCollider(origin.x + x, origin.z + z, r);
  const rand = rng(17);
  const put = (mesh, x, y, z, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  const snowTex = paint(1024, 1024, (g, w, h) => {
    g.fillStyle = '#eef2f6';
    g.fillRect(0, 0, w, h);
    const r = rng(6);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = r() < 0.3 ? 'rgba(110,104,98,0.35)' : 'rgba(200,214,232,0.35)';
      g.beginPath();
      g.ellipse(r() * w, r() * h, 3 + r() * 22, 2 + r() * 10, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  floatingBase(root, R, new THREE.MeshStandardMaterial({ map: snowTex, roughness: 0.95 }), ['#9a9690', '#7e7a76', '#686460', '#55524f'], '#8a8580');

  // ---------- the great peaks around the plateau, rising out of the clouds ----------
  // K2 straight ahead from the gate: a steep, lonely pyramid.
  const k2 = mountain(80, 200, 2.2, 0.42, 4);
  k2.position.set(0, 200 / 2 - 70, -185);
  root.add(k2);
  // The rest of the range rings the plateau at a distance: Broad Peak, the Gasherbrums, Masherbrum...
  [[0.5, 175, 90, 165], [-0.55, 170, 85, 150], [1.1, 190, 95, 140], [-1.1, 185, 90, 135], [1.7, 215, 110, 150], [-1.7, 210, 100, 145], [2.45, 240, 120, 130], [-2.45, 245, 120, 140], [3.14, 270, 130, 120]].forEach(([a, d, r, h], i) => {
    const m = mountain(r, h, i * 1.7 + 0.4, 0.46, 3 + (i % 3));
    m.position.set(Math.sin(a) * d, h / 2 - 70, -Math.cos(a) * d);
    root.add(m);
  });

  // Wind-sculpted snow drifts across the plateau.
  const drift = std('#f1f4f8', { roughness: 0.9 });
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const d = 14 + rand() * 46;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.hypot(x - 18, z - 18) < 12 || Math.hypot(x - 12, z + 20) < 11 || (Math.abs(x) < 6 && z > 40)) continue;
    const m = put(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), drift), x, -0.05, z, false);
    m.scale.set(3 + rand() * 5, 0.35 + rand() * 0.5, 1.5 + rand() * 2);
    m.rotation.y = 0.7 + (rand() - 0.5) * 0.3; // all aligned with the prevailing wind
  }

  // ---------- granite boulders, glacier, frozen lake ----------
  const granite = std('#8e8a84', { flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const d = 20 + rand() * 40;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.hypot(x - 18, z - 18) < 10 || Math.hypot(x + 30, z + 18) < 12 || Math.hypot(x + 37, z + 25) < 13 || Math.hypot(x + 14, z - 30) < 5 || Math.hypot(x - 32, z - 27) < 6 || Math.hypot(x - 12, z + 20) < 11 || (Math.abs(x) < 5 && z > 40)) continue;
    const s = 1 + rand() * 2.2;
    const b = rock(s, i * 3.1, { color: '#8e8a84', dark: '#5b5752', snow: 1 });
    b.position.set(x, -0.1, z);
    b.rotation.y = rand() * 6;
    root.add(b);
    col(x, z, s * 0.9);
  }
  // Glacier tongue: blue-white ice ridges flowing across the plateau.
  const ice = std('#cfe3f2', { roughness: 0.25, metalness: 0.05, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const ridge = put(new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 6), ice), -30 + i * 2.2 - 8, 0.2, -18 - i * 3.6 + 6);
    ridge.scale.set(1.6, 0.35, 1);
    ridge.rotation.y = 0.6;
    col(-38 + i * 2.2, -12 - i * 3.6, 2.6);
  }
  const lakeTex = paint(512, 512, (g, w, h) => {
    g.fillStyle = '#a9d2ea';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      let x = r() * w;
      let y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (r() - 0.5) * 80), (y += (r() - 0.5) * 80));
      g.stroke();
    }
  });
  put(new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lakeTex, roughness: 0.08, metalness: 0.15 })), 12, 0.03, -20, false);

  // ---------- base camp: dome tents, a cairn, strings of pennants ----------
  const tentCols = ['#ff7a1a', '#ffc21a', '#e8402c', '#ff9a3c', '#2f6fe4'];
  [[14, 14], [20, 13], [22, 20], [15, 22], [26, 16]].forEach(([x, z], i) => {
    const tent = put(new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(tentCols[i], { roughness: 0.6 })), x, 0, z);
    tent.scale.set(1, 0.85, 1.25);
    const door = put(new THREE.Mesh(new THREE.CircleGeometry(0.6, 12, 0, Math.PI), std('#3a2a1c')), x, 0.02, z + 2.1, false);
    door.rotation.y = 0;
    col(x, z, 1.9);
  });
  for (let k = 0; k < 6; k++) put(new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 - k * 0.09, 0), granite), 8, 0.4 + k * 0.6, 24);
  col(8, 24, 0.9);
  const flagCols = ['#e8402c', '#2f6fe4', '#ffc21a', '#2fa84f', '#ffffff'];
  const poles = [[10, 10], [28, 10], [28, 26], [10, 26]];
  poles.forEach(([x, z]) => {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), std('#5a4a3a')), x, 2, z);
    col(x, z, 0.4);
  });
  const pennant = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0, 0, 0.25, -0.5, 0], 3));
  pennant.computeVertexNormals();
  const flags = [];
  poles.forEach(([x1, z1], i) => {
    const [x2, z2] = poles[(i + 1) % 4];
    for (let k = 1; k < 12; k++) {
      const f = k / 12;
      const sag = Math.sin(f * Math.PI) * 0.7;
      const m = put(new THREE.Mesh(pennant, std(flagCols[k % 5], { side: THREE.DoubleSide, roughness: 0.7 })), x1 + (x2 - x1) * f, 3.9 - sag, z1 + (z2 - z1) * f, false);
      m.rotation.y = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
      flags.push(m);
    }
  });

  // ---------- the markhor on its outcrop ----------
  const mk = markhor();
  const MX = 12;
  const MZ = -38;
  let outcropTop = 3.35;
  [[0, -0.4, 0, 3.2], [2.4, -0.3, 1.6, 2.2], [-2.2, -0.3, -1, 2]].forEach(([x, y, z, s], i) => {
    const r = rock(s, 40 + i, { color: '#8e8a84', dark: '#5b5752', snow: 1, flat: 0.85 });
    r.position.set(MX + x, y, MZ + z);
    root.add(r);
    if (!i) outcropTop = new THREE.Box3().setFromObject(r).max.y - 0.2;
  });
  col(MX, MZ, 3.6);
  mk.group.position.set(MX, outcropTop, MZ);
  mk.group.rotation.y = 2.6;
  mk.group.scale.setScalar(1.3);
  root.add(mk.group);

  // ---------- seracs: blue ice towers where the glacier breaks up ----------
  const serac = new THREE.MeshPhysicalMaterial({ color: '#a9d4f0', roughness: 0.18, transmission: 0.25, thickness: 1.5, clearcoat: 0.6 });
  for (let i = 0; i < 14; i++) {
    const x = -46 + rand() * 18;
    const z = -34 + rand() * 18;
    const h = 1.2 + rand() * 2.6;
    const m = put(new THREE.Mesh(new THREE.CylinderGeometry(0.2 + rand() * 0.4, 0.9 + rand() * 0.6, h, 5), serac), x, h / 2 - 0.1, z);
    m.rotation.set((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4);
    col(x, z, 0.9);
  }

  // ---------- the Gilkey Memorial: a cairn of stones and engraved plates for climbers lost on K2 ----------
  {
    const GX = -14;
    const GZ = 30;
    for (let k = 0; k < 9; k++) {
      const st = rock(1.5 - k * 0.13, 70 + k, { color: '#9a958e', dark: '#6a655f', snow: 0.4, flat: 0.55 });
      st.position.set(GX + Math.sin(k * 2.1) * 0.2, k * 0.55, GZ + Math.cos(k * 2.1) * 0.2);
      st.rotation.y = k * 1.3;
      root.add(st);
    }
    const plate = std('#c9ccd1', { metalness: 0.8, roughness: 0.35 });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const m = put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.03), plate), GX + Math.sin(a) * 1.15, 0.7 + (k % 4) * 0.6, GZ + Math.cos(a) * 1.15, false);
      m.rotation.y = a;
    }
    col(GX, GZ, 1.8);
    const sign = label('Gilkey Memorial', '#5a5245', 7);
    sign.position.set(GX, 7, GZ);
    root.add(sign);
  }

  // ---------- yaks grazing near base camp ----------
  const yaks = [[30, 30, 2.2], [35, 24, -0.6]].map(([x, z, ry], i) => {
    const y = yak(i);
    y.group.position.set(x, 0, z);
    y.group.rotation.y = ry;
    root.add(y.group);
    col(x, z, 1.6);
    return y;
  });

  // ---------- spindrift: wind tearing a plume of snow off K2's summit ----------
  const plumeTex = paint(256, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.08;
      g.beginPath();
      g.ellipse(i * 5, h / 2 + Math.sin(i) * 6, 30 + i * 2, 8 + i * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
  const plume = new THREE.Mesh(new THREE.PlaneGeometry(90, 18), new THREE.MeshBasicMaterial({ map: plumeTex, transparent: true, depthWrite: false, opacity: 0.55, fog: true }));
  plume.geometry.translate(45, 0, 0);
  plume.position.set(2, 200 - 70 - 4, -185);
  root.add(plume);

  const gate = makeGate(root, 0, 56, Math.PI, 'Sky Gate');
  const nameSign = label('Karakoram Peaks', '#2f6fe4');
  nameSign.position.set(0, 12, 30);
  root.add(nameSign);
  const world = (s) => ({ ...s, x: origin.x + s.x, z: origin.z + s.z });
  let mkSeen = false;
  return {
    id: 'peaks',
    group: root,
    bounds: { x: origin.x, z: origin.z, r: R - 3 },
    spawn: { x: origin.x, z: origin.z + 50 },
    movers: [mk.group, ...yaks.map((y) => y.group), plume, ...flags],
    gate: { x: origin.x + gate.spot.x, z: origin.z + gate.spot.z },
    env: { cloudSea: true, ocean: false, fog: 2.2, snow: 1 },
    spots: SPOTS.map(world),
    animal: { def: MARKHOR, x: origin.x + MX, z: origin.z + MZ },
    // The markhor is wary: it's only on its rock on some visits.
    onEnter() {
      mk.group.visible = Math.random() < 0.7;
      mkSeen = false;
    },
    animalVisible: () => mk.group.visible,
    map: [
      { x: 12, z: -20, r: 9, color: 'rgba(169,210,234,0.95)' },
      { x: -30, z: -18, r: 10, color: 'rgba(207,227,242,0.95)' },
      { x: 18, z: 18, r: 9, color: 'rgba(255,122,26,0.55)' },
      { x: MX, z: MZ, r: 3.6, color: 'rgba(142,138,132,0.95)' },
      { x: gate.spot.x, z: gate.spot.z, r: 2.5, color: '#2f6fe4' },
    ].map(world),
    ground: '#eef2f6',
    update(dt, t, player) {
      flags.forEach((f, i) => (f.rotation.x = Math.sin(t * 4 + i) * 0.35)); // flapping in the wind
      plume.material.opacity = 0.4 + Math.sin(t * 0.3) * 0.15;
      plume.scale.x = 1 + Math.sin(t * 0.21) * 0.15;
      yaks.forEach((y, i) => {
        // Heads down grazing, now and then lifting to chew and look around.
        const up = Math.max(0, Math.sin(t * 0.25 + i * 2));
        y.head.rotation.x = 0.7 - up * 0.8;
        y.tail.rotation.z = Math.sin(t * 2 + i) * 0.3;
      });
      if (mk.group.visible) {
        const lx = player.x - (origin.x + MX);
        const lz = player.z - (origin.z + MZ);
        const near = Math.hypot(lx, lz) < 10;
        mk.head.rotation.y = near ? THREE.MathUtils.clamp(Math.atan2(lx, lz) - mk.group.rotation.y, -0.8, 0.8) : Math.sin(t * 0.35) * 0.5;
        mk.head.rotation.x = Math.sin(t * 0.7) * 0.05;
      }
      return mkSeen;
    },
  };
}
