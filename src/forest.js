import * as THREE from 'three';
import { FOREST, ANIMALS } from './data.js';
import { textCanvas } from './world.js';
import { gpuSway } from './perf.js';

// Highland Forest: a dense patch of woods on the south-east rim with macaws in the canopy, birdsong,
// and a handful of rare animals that only sometimes show themselves. Every creature is built from
// smooth shaded shapes with real proportions and painted fur, not low-poly cut-outs.

// ---------- helpers ----------
const fur = (color, map = null, rough = 0.95) => new THREE.MeshStandardMaterial({ color, map, roughness: rough });
const ell = (rx, ry, rz, mat, seg = 24) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
};
const cap = (r, len, mat) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
  m.castShadow = true;
  return m;
};
const at = (m, x, y, z) => (m.position.set(x, y, z), m);
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function paint(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
// Eye: dark glossy ball with a tiny highlight, so animals look alive.
function eye(r, iris = '#1a120c') {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshStandardMaterial({ color: iris, roughness: 0.15, metalness: 0.1 })));
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hl.position.set(r * 0.35, r * 0.4, r * 0.75);
  g.add(hl);
  return g;
}

// ---------- fur textures (top of the canvas = the animal's back, bottom = its belly) ----------
const leopardCoat = () =>
  paint(512, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#c9c3b6');
    grad.addColorStop(0.65, '#ddd8cc');
    grad.addColorStop(1, '#f3f0e8');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const r = rng(9);
    // Rosettes: broken dark rings with a smoky centre, smaller solid spots in between.
    for (let i = 0; i < 90; i++) {
      const x = r() * w;
      const y = r() * h * 0.78;
      const s = 7 + r() * 9;
      g.fillStyle = 'rgba(120,112,100,0.45)';
      g.beginPath();
      g.arc(x, y, s * 0.7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#3b3936';
      g.lineWidth = 2.5 + r() * 2;
      for (let k = 0; k < 4; k++) {
        const a0 = (k / 4) * Math.PI * 2 + r() * 0.5;
        g.beginPath();
        g.arc(x, y, s, a0, a0 + 0.9 + r() * 0.5);
        g.stroke();
      }
    }
    g.fillStyle = '#34322f';
    for (let i = 0; i < 160; i++) {
      g.beginPath();
      g.arc(r() * w, r() * h * 0.85, 1.5 + r() * 2.5, 0, Math.PI * 2);
      g.fill();
    }
  });
const kakapoFeathers = () =>
  paint(256, 256, (g, w, h) => {
    g.fillStyle = '#86a03c';
    g.fillRect(0, 0, w, h);
    const r = rng(4);
    // Fine dark barring and yellowish flecks, like the bird's moss-camouflage plumage.
    for (let i = 0; i < 700; i++) {
      const x = r() * w;
      const y = r() * h;
      g.strokeStyle = r() < 0.7 ? 'rgba(40,52,18,0.65)' : 'rgba(230,220,120,0.55)';
      g.lineWidth = 1 + r() * 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 3, y + 2, x + 7 + r() * 4, y);
      g.stroke();
    }
  });

// ---------- animals (all face +z) ----------
function makeBamboo(len, rand) {
  const g = new THREE.Group();
  const green = fur(rand() < 0.5 ? '#7fa33c' : '#6b9634', null, 0.6);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, len, 8), green);
  stalk.position.y = len / 2;
  stalk.castShadow = true;
  g.add(stalk);
  const node = new THREE.TorusGeometry(0.068, 0.014, 5, 12);
  const nodeMat = fur('#55762a', null, 0.6);
  for (let y = 0.5; y < len; y += 0.55) {
    const n = new THREE.Mesh(node, nodeMat);
    n.rotation.x = Math.PI / 2;
    n.position.y = y;
    g.add(n);
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: '#5f8f2e', roughness: 0.8, side: THREE.DoubleSide });
  const leafGeo = new THREE.PlaneGeometry(0.09, 0.55);
  leafGeo.translate(0, 0.27, 0);
  for (let k = 0; k < 9; k++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.y = len - 0.2 - (k % 3) * 0.5;
    leaf.rotation.set(1.0 + rand() * 0.5, (k / 9) * Math.PI * 2, 0);
    g.add(leaf);
  }
  return g;
}

function giantPanda() {
  const g = new THREE.Group();
  const white = fur('#f2efe8');
  const black = fur('#1d1c1e');
  g.add(at(ell(0.78, 0.62, 0.72, white), 0, 0.62, -0.05));
  const chest = at(ell(0.6, 0.66, 0.55, white), 0, 1.18, 0.06);
  g.add(chest);
  g.add(at(ell(0.65, 0.3, 0.59, black), 0, 1.34, 0.02)); // the black shoulder band
  [-1, 1].forEach((s) => {
    const leg = at(ell(0.27, 0.25, 0.5, black), s * 0.47, 0.3, 0.4);
    leg.rotation.y = s * 0.35;
    const pad = at(ell(0.17, 0.2, 0.08, fur('#3b3536')), s * 0.6, 0.32, 0.84);
    pad.rotation.y = s * 0.35;
    g.add(leg, pad);
  });
  const arm = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.5, 1.4, 0.18);
    pivot.add(at(cap(0.17, 0.45, black), 0, -0.34, 0));
    pivot.rotation.x = -0.9;
    pivot.rotation.z = s * 0.25;
    g.add(pivot);
    return pivot;
  };
  arm(-1);
  const armR = arm(1);
  const bamboo = makeBamboo(1.5, rng(3));
  bamboo.position.set(0, -0.62, 0.05);
  bamboo.rotation.x = 1.7;
  armR.add(bamboo);
  const head = new THREE.Group();
  head.position.set(0, 1.86, 0.14);
  head.add(ell(0.44, 0.4, 0.4, white));
  head.add(at(ell(0.21, 0.15, 0.18, white), 0, -0.11, 0.33));
  head.add(at(ell(0.08, 0.055, 0.05, black), 0, -0.04, 0.5));
  [-1, 1].forEach((s) => {
    head.add(at(ell(0.14, 0.14, 0.08, black), s * 0.3, 0.3, -0.02));
    const patch = at(ell(0.1, 0.15, 0.06, black), s * 0.16, 0.03, 0.34);
    patch.rotation.z = s * 0.55;
    head.add(patch);
    head.add(at(eye(0.035), s * 0.165, 0.06, 0.385));
  });
  g.add(head);
  return {
    group: g,
    update(dt, t) {
      // Lift the bamboo, take a bite, lower it: every four seconds or so.
      const k = (t % 4.2) / 4.2;
      const lift = k < 0.25 ? k / 0.25 : k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.2);
      armR.rotation.x = -0.9 - lift * 0.9;
      head.rotation.x = lift * 0.12 + Math.sin(t * 9) * 0.02 * lift; // chewing
      chest.scale.y = 0.66 * (1 + Math.sin(t * 1.3) * 0.015);
    },
  };
}

function redPanda() {
  const g = new THREE.Group();
  const russet = fur('#b4532a');
  const dark = fur('#2b1b14');
  const cream = fur('#efd6b0');
  const white = fur('#f4efe6');
  g.add(at(ell(0.28, 0.3, 0.42, russet), 0, 0.33, 0));
  g.add(at(ell(0.24, 0.24, 0.33, dark), 0, 0.25, 0.05));
  [[-0.16, 0.2], [0.16, 0.2], [-0.16, -0.18], [0.16, -0.18]].forEach(([x, z]) => {
    const leg = at(cap(0.065, 0.22, dark), x, 0.08, z);
    leg.rotation.x = 0.2;
    g.add(leg);
  });
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0.3);
  head.add(ell(0.24, 0.21, 0.22, russet));
  head.add(at(ell(0.11, 0.08, 0.1, white), 0, -0.07, 0.17));
  head.add(at(ell(0.035, 0.025, 0.025, dark), 0, -0.04, 0.27));
  [-1, 1].forEach((s) => {
    head.add(at(ell(0.08, 0.07, 0.05, white), s * 0.13, -0.05, 0.14)); // cheek marks
    head.add(at(ell(0.035, 0.03, 0.02, white), s * 0.08, 0.08, 0.19)); // "eyebrow" spots
    head.add(at(eye(0.028), s * 0.085, 0.025, 0.19));
    const earRim = at(ell(0.1, 0.11, 0.04, white), s * 0.17, 0.17, -0.04);
    const ear = at(ell(0.08, 0.09, 0.045, russet), s * 0.17, 0.17, -0.02);
    head.add(earRim, ear);
  });
  g.add(head);
  // Long bushy tail with cream rings, hanging off the branch.
  const tail = [];
  let parent = g;
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i ? -0.11 : 0.28, i ? 0 : -0.36);
    seg.rotation.x = i ? 0.04 : 2.6;
    seg.add(at(ell(0.11, 0.08, 0.11, i % 2 ? cream : russet), 0, -0.055, 0));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  return {
    group: g,
    update(dt, t) {
      tail.forEach((s, i) => (s.rotation.z = Math.sin(t * 0.9 - i * 0.35) * 0.06));
      head.rotation.y = Math.sin(t * 0.35) * 0.7;
      head.rotation.x = Math.sin(t * 0.5) * 0.1;
    },
  };
}

function snowLeopard() {
  const g = new THREE.Group();
  const coat = fur('#ffffff', leopardCoat());
  const pale = fur('#ece8de');
  const body = at(ell(0.42, 0.37, 0.95, coat), 0, 0.6, 0);
  g.add(body, at(ell(0.38, 0.4, 0.45, coat), 0, 0.68, 0.6), at(ell(0.4, 0.36, 0.42, coat), 0, 0.62, -0.6));
  [-1, 1].forEach((s) => {
    const fore = at(cap(0.12, 0.5, coat), s * 0.22, 0.25, 0.95);
    fore.rotation.x = 1.35; // front legs stretched forward, lying down
    g.add(fore, at(ell(0.15, 0.09, 0.2, pale), s * 0.22, 0.1, 1.28));
    g.add(at(ell(0.2, 0.28, 0.42, coat), s * 0.3, 0.42, -0.5)); // folded haunch
    g.add(at(ell(0.14, 0.09, 0.22, pale), s * 0.3, 0.1, -0.2));
  });
  const head = new THREE.Group();
  head.position.set(0, 1.0, 1.08);
  head.add(ell(0.29, 0.25, 0.29, coat));
  head.add(at(ell(0.16, 0.12, 0.15, pale), 0, -0.08, 0.23));
  head.add(at(ell(0.055, 0.04, 0.04, fur('#7a6662')), 0, -0.02, 0.37));
  [-1, 1].forEach((s) => {
    head.add(at(eye(0.042, '#a7b98a'), s * 0.12, 0.05, 0.24)); // pale green-grey eyes
    head.add(at(ell(0.08, 0.08, 0.04, fur('#4a4744')), s * 0.2, 0.2, -0.04));
  });
  g.add(head);
  // The famously thick, long tail: as long as the body, curling round onto the rock.
  const tail = [];
  let parent = g;
  for (let i = 0; i < 12; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i ? 0 : 0.7, i ? -0.17 : -0.95);
    seg.rotation.set(i ? 0.11 : 0.5, i ? 0.13 : 0, 0);
    seg.add(at(ell(0.12, 0.12, 0.12, coat), 0, 0, -0.08));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  tail[11].children[0].material = fur('#3a3835'); // dark tip
  let look = 0;
  return {
    group: g,
    update(dt, t, toPlayer) {
      tail.forEach((s, i) => (s.rotation.y = 0.13 + Math.sin(t * 0.8 - i * 0.45) * 0.07));
      // Slowly scans the slopes; turns to watch you when you get close.
      const goal = toPlayer !== null ? toPlayer : Math.sin(t * 0.22) * 0.7;
      look += (THREE.MathUtils.clamp(goal, -1.1, 1.1) - look) * Math.min(1, dt * 2);
      head.rotation.y = look;
      body.scale.y = 0.37 * (1 + Math.sin(t * 1.2) * 0.02);
    },
  };
}

function kakapo() {
  const g = new THREE.Group();
  const feathers = fur('#ffffff', kakapoFeathers());
  const inner = new THREE.Group(); // waddle
  g.add(inner);
  const body = at(ell(0.42, 0.47, 0.5, feathers), 0, 0.56, 0);
  body.rotation.x = 0.25;
  inner.add(body, at(ell(0.35, 0.38, 0.4, fur('#c7c36a')), 0, 0.5, 0.12));
  [-1, 1].forEach((s) => {
    inner.add(at(ell(0.11, 0.33, 0.42, fur('#6f8a30')), s * 0.36, 0.62, -0.04));
    inner.add(at(cap(0.045, 0.12, fur('#8d8a86')), s * 0.15, 0.13, 0.05));
    for (let k = -1; k <= 1; k++) {
      const toe = at(cap(0.025, 0.12, fur('#8d8a86')), s * 0.15 + k * 0.05, 0.03, 0.14);
      toe.rotation.x = Math.PI / 2;
      toe.rotation.y = k * 0.4;
      inner.add(toe);
    }
  });
  inner.add(at(ell(0.18, 0.06, 0.3, fur('#6f8a30')), 0, 0.38, -0.5));
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.26);
  head.add(ell(0.27, 0.26, 0.27, feathers));
  head.add(at(ell(0.22, 0.2, 0.08, fur('#cfc683')), 0, -0.02, 0.2)); // owl-like facial disc
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 10), fur('#ece4c9', null, 0.5));
  beak.rotation.x = 2.3;
  beak.position.set(0, -0.08, 0.3);
  head.add(beak);
  [-1, 1].forEach((s) => head.add(at(eye(0.042), s * 0.11, 0.05, 0.25)));
  inner.add(head);
  const home = new THREE.Vector3();
  let a = 0;
  return {
    group: g,
    setHome(v) {
      home.copy(v);
    },
    update(dt, t) {
      // Waddles slowly round a small loop, rocking side to side.
      a += dt * 0.25;
      g.position.set(home.x + Math.cos(a) * 1.3, home.y, home.z + Math.sin(a) * 1.3);
      g.rotation.y = -a;
      inner.rotation.z = Math.sin(t * 5) * 0.08;
      head.rotation.x = Math.sin(t * 2.5) * 0.08;
    },
  };
}

function pangolin() {
  const g = new THREE.Group();
  const scaleMat = new THREE.MeshStandardMaterial({ color: '#8b6a47', roughness: 0.5, metalness: 0.1 });
  const skin = fur('#c9a688');
  const scaleGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const body = new THREE.Group();
  g.add(body);
  // Overlapping rows of keratin scales along a spine that tapers into the tail.
  const rows = 26;
  for (let i = 0; i < rows; i++) {
    const s = i / (rows - 1);
    const z = 0.55 - s * 2.3;
    const tail = Math.max(0, (s - 0.5) / 0.5);
    const y = 0.42 - tail * tail * 0.3;
    const rad = 0.33 * Math.sin(Math.PI * (0.12 + 0.88 * Math.min(1, s * 1.6))) * (1 - tail * 0.75) + 0.04;
    const n = Math.max(4, Math.round(9 * (1 - tail * 0.5)));
    for (let k = 0; k < n; k++) {
      const a = -2.0 + (4.0 * k) / (n - 1);
      const scale = new THREE.Mesh(scaleGeo, scaleMat);
      scale.scale.set(rad * 0.42, 0.035, rad * 0.5);
      scale.position.set(Math.sin(a) * rad, y + Math.cos(a) * rad * 0.9, z);
      scale.rotation.set(0.35, 0, -a);
      scale.castShadow = true;
      body.add(scale);
    }
  }
  body.add(at(ell(0.26, 0.18, 0.6, skin), 0, 0.3, -0.1));
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.78);
  head.add(ell(0.13, 0.12, 0.2, skin));
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 10), skin);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.03, 0.26);
  head.add(snout);
  [-1, 1].forEach((s) => head.add(at(eye(0.022), s * 0.08, 0.04, 0.12)));
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 6), fur('#d97a8a', null, 0.5));
  tongue.rotation.x = Math.PI / 2;
  tongue.position.set(0, -0.04, 0.38);
  head.add(tongue);
  g.add(head);
  const legs = [[-0.2, 0.42], [0.2, 0.42], [-0.22, -0.45], [0.22, -0.45]].map(([x, z]) => {
    const p = new THREE.Group();
    p.position.set(x, 0.3, z);
    p.add(at(cap(0.06, 0.18, skin), 0, -0.14, 0));
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), fur('#3a2e24', null, 0.5));
    claw.rotation.x = Math.PI / 2;
    claw.position.set(0, -0.28, 0.06);
    p.add(claw);
    g.add(p);
    return p;
  });
  const home = new THREE.Vector3();
  let a = 0;
  return {
    group: g,
    setHome(v) {
      home.copy(v);
    },
    update(dt, t) {
      a += dt * 0.18;
      g.position.set(home.x + Math.cos(a) * 1.8, home.y, home.z + Math.sin(a) * 1.8);
      g.rotation.y = -a;
      legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 4 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.35));
      body.rotation.z = Math.sin(t * 2) * 0.03;
      tongue.scale.y = Math.max(0.01, Math.sin(t * 3)); // flicking for ants
      head.rotation.x = 0.15 + Math.sin(t * 1.5) * 0.08;
    },
  };
}

// Macaw: red (scarlet) or blue-and-gold, long tail, white face, hooked beak.
function macaw(kind) {
  const c = kind === 'scarlet' ? { body: '#d42a1f', wing: '#2459b8', band: '#f2c230', tail: '#c4231c' } : { body: '#2a73c9', wing: '#1f5fb0', band: '#2a73c9', tail: '#1d58a8', belly: '#f2b51e' };
  const g = new THREE.Group();
  const bodyMat = fur(c.body, null, 0.7);
  const inner = new THREE.Group();
  g.add(inner);
  inner.add(at(ell(0.14, 0.15, 0.3, bodyMat), 0, 0, 0));
  if (c.belly) inner.add(at(ell(0.12, 0.12, 0.24, fur(c.belly, null, 0.7)), 0, -0.04, 0.03));
  const head = new THREE.Group();
  head.position.set(0, 0.08, 0.3);
  head.add(ell(0.12, 0.12, 0.12, bodyMat));
  [-1, 1].forEach((s) => {
    head.add(at(ell(0.02, 0.07, 0.06, fur('#f5f1ea')), s * 0.1, 0, 0.03)); // bare white face
    head.add(at(eye(0.022, '#e8e0c0'), s * 0.11, 0.03, 0.05));
  });
  const beak = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.03, 6, 10, Math.PI), fur(kind === 'scarlet' ? '#efe6d6' : '#1d1d1d', null, 0.4));
  beak.rotation.set(0, Math.PI / 2, -0.4);
  beak.position.set(0, -0.02, 0.13);
  head.add(beak);
  inner.add(head);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.1, 0.05, 0.02);
    const covert = at(ell(0.22, 0.02, 0.13, fur(c.band, null, 0.7)), s * 0.2, 0, 0.02);
    const flight = at(ell(0.3, 0.018, 0.12, fur(c.wing, null, 0.7)), s * 0.38, -0.01, -0.03);
    pivot.add(covert, flight);
    inner.add(pivot);
    return { pivot, s };
  });
  [-0.03, 0.03].forEach((x, i) => inner.add(at(ell(0.03, 0.012, 0.36, fur(i ? c.wing : c.tail, null, 0.7)), x, -0.02, -0.55)));
  return {
    group: g,
    // perched: body upright, wings folded; flying: level body, flapping.
    pose(t, flying) {
      inner.rotation.x = flying ? 0 : -1.0;
      wings.forEach(({ pivot, s }) => {
        // Perched: wings swing back and lie along the body. Flying: spread and beat.
        pivot.rotation.y = flying ? 0 : s * 1.45;
        pivot.rotation.z = flying ? s * Math.sin(t * 14) * 0.9 : 0;
      });
      head.rotation.x = flying ? 0 : 1.0;
      head.rotation.y = flying ? 0 : Math.sin(t * 0.7) * 0.5;
    },
  };
}

// ---------- the forest ----------
// ctx: { scene, addCollider, getAudio, soundOn: () => bool, onEnter(), onSpot(def, first) }
export function createForest(ctx) {
  const { scene } = ctx;
  const { x: fx, z: fz, r: R } = FOREST;
  const rand = rng(21);
  const root = new THREE.Group();
  root.position.set(fx, 0, fz);
  scene.add(root);

  // Mossy, leaf-littered floor.
  const floorTex = paint(512, 512, (g, w, h) => {
    g.fillStyle = '#4c6a33';
    g.fillRect(0, 0, w, h);
    const r = rng(2);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(110,80,40,0.35)' : 'rgba(40,70,25,0.4)';
      g.beginPath();
      g.ellipse(r() * w, r() * h, 2 + r() * 6, 1 + r() * 3, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 3, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
  floor.position.y = 0.015;
  floor.receiveShadow = true;
  root.add(floor);

  // Spots for the animals (relative to the forest's centre), kept clear of trees.
  const SPOT = {
    panda: new THREE.Vector3(-6, 0, -3),
    redpanda: new THREE.Vector3(3, 0, -6.5),
    leopard: new THREE.Vector3(7, 0, 6),
    kakapo: new THREE.Vector3(-3, 0, 6),
    pangolin: new THREE.Vector3(4.5, 0, -0.5),
  };
  const clear = (x, z, pad = 2.4) => Object.values(SPOT).every((s) => Math.hypot(x - s.x, z - s.z) > pad);
  const world = (v) => new THREE.Vector3(fx + v.x, v.y, fz + v.z);
  // Stay on the island: the forest sits at the rim.
  const onIsland = (x, z, pad = 2) => Math.hypot(fx + x, fz + z) < 76 - pad;

  // ---- tall trees: dark, dense canopy ----
  const bark = new THREE.MeshStandardMaterial({ color: '#4a3628', roughness: 0.95 });
  const leafCols = ['#2f5a2c', '#3a6b33', '#27502a', '#456f36'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const crowns = [];
  const trees = [];
  // Spaced so Byte (radius 1) always fits between two trunks; the wide crowns keep it looking dense.
  for (let tries = 0; trees.length < 34 && tries < 1500; tries++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * R;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (!onIsland(x, z) || !clear(x, z, 2.6) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
    trees.push({ x, z });
    const h = 5.5 + rand() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, h, 8), bark);
    trunk.position.set(x, h / 2, z);
    trunk.castShadow = true;
    root.add(trunk);
    const crown = new THREE.Group();
    crown.position.set(x, h, z);
    // Each crown has its own material so it can fade out on its own when Byte walks underneath.
    const crownMat = gpuSway(leafCols[trees.length % 4].clone(), 0.008);
    crown.userData.mat = crownMat;
    const n = 5 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const ka = (k / n) * Math.PI * 2 + rand();
      const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + rand() * 0.9, 1), crownMat);
      clump.position.set(Math.cos(ka) * 1.4, (rand() - 0.3) * 1.2, Math.sin(ka) * 1.4);
      clump.castShadow = true;
      crown.add(clump);
    }
    root.add(crown);
    crowns.push(crown);
    // Vines dangling from the canopy.
    if (rand() < 0.5) {
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h * 0.6, 4), leafCols[1]);
      vine.position.set(x + 0.9, h * 0.7, z + 0.3);
      root.add(vine);
    }
    ctx.addCollider(fx + x, fz + z, 0.45);
  }

  // ---- bamboo grove around the panda ----
  for (let k = 0; k < 26; k++) {
    const a = rand() * Math.PI * 2;
    const d = 1.8 + rand() * 2.2;
    const x = SPOT.panda.x + Math.cos(a) * d;
    const z = SPOT.panda.z + Math.sin(a) * d;
    if (!onIsland(x, z)) continue;
    const b = makeBamboo(4.5 + rand() * 3.5, rand);
    b.position.set(x, 0, z);
    b.rotation.set((rand() - 0.5) * 0.15, rand() * 6, (rand() - 0.5) * 0.15);
    root.add(b);
    ctx.addCollider(fx + x, fz + z, 0.25);
  }

  // ---- rock ledge for the snow leopard ----
  const rockMat = new THREE.MeshStandardMaterial({ color: '#8c8a86', roughness: 0.95, flatShading: true });
  [[0, 0.5, 0, 1.9], [-1.3, 0.4, 0.9, 1.3], [1.2, 0.3, -0.8, 1.2]].forEach(([x, y, z, s]) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
    rock.position.set(SPOT.leopard.x + x, y, SPOT.leopard.z + z);
    rock.scale.set(1.3, 0.8, 1.1);
    rock.castShadow = true;
    rock.receiveShadow = true;
    root.add(rock);
  });
  SPOT.leopard.y = 1.88; // lying on top of the main rock
  ctx.addCollider(fx + SPOT.leopard.x, fz + SPOT.leopard.z, 2.4);

  ctx.addCollider(fx + SPOT.panda.x, fz + SPOT.panda.z, 1.1);

  // ---- the red panda's tree with a low branch ----
  const rpTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 9), bark);
  rpTrunk.position.set(SPOT.redpanda.x - 1.4, 3.5, SPOT.redpanda.z);
  rpTrunk.castShadow = true;
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 2.4, 7), bark);
  branch.rotation.z = Math.PI / 2 - 0.12;
  branch.position.set(SPOT.redpanda.x - 0.3, 3.0, SPOT.redpanda.z);
  root.add(rpTrunk, branch);
  const rpCrown = new THREE.Group();
  rpCrown.position.set(SPOT.redpanda.x - 1.4, 7, SPOT.redpanda.z);
  rpCrown.userData.mat = gpuSway(leafCols[2].clone(), 0.008);
  for (let k = 0; k < 6; k++) {
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), rpCrown.userData.mat);
    clump.position.set(Math.cos(k) * 1.5, rand() * 0.8, Math.sin(k) * 1.5);
    rpCrown.add(clump);
  }
  root.add(rpCrown);
  crowns.push(rpCrown);
  SPOT.redpanda.y = 3.12;
  ctx.addCollider(fx + SPOT.redpanda.x - 1.4, fz + SPOT.redpanda.z, 0.7);

  // ---- ferns, a fallen log, light shafts ----
  const frond = new THREE.PlaneGeometry(0.28, 1.1, 1, 4);
  const fp = frond.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, -((fp.getY(i) + 0.55) ** 2) * 0.35); // arch over
  frond.translate(0, 0.55, 0);
  frond.computeVertexNormals();
  const ferns = new THREE.InstancedMesh(frond, new THREE.MeshStandardMaterial({ color: '#4f8034', roughness: 0.85, side: THREE.DoubleSide }), 260);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let fi = 0;
  for (let k = 0; k < 40 && fi < 260; k++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * (R + 1);
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    if (!onIsland(cx, cz, 1) || !clear(cx, cz, 1.6)) continue;
    for (let j = 0; j < 6 && fi < 260; j++) {
      e.set(-0.5 - rand() * 0.4, (j / 6) * Math.PI * 2 + rand() * 0.4, 0, 'YXZ');
      q.setFromEuler(e);
      const s = 0.7 + rand() * 0.6;
      ferns.setMatrixAt(fi++, m4.compose(new THREE.Vector3(cx, 0.02, cz), q, new THREE.Vector3(s, s, s)));
    }
  }
  ferns.count = fi;
  root.add(ferns);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 4, 10), bark);
  log.rotation.set(0, 0.6, Math.PI / 2);
  log.position.set(-1, 0.35, 1.5);
  log.castShadow = true;
  root.add(log, at(ell(0.3, 0.1, 1.6, leafCols[3]), -1, 0.66, 1.5));
  ctx.addCollider(fx - 1, fz + 1.5, 0.9);
  const shaftTex = paint(64, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,248,215,0.55)');
    grad.addColorStop(1, 'rgba(255,248,215,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const shafts = [];
  for (let k = 0; k < 7; k++) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.5 }));
    const a = rand() * Math.PI * 2;
    const d = rand() * R * 0.8;
    sh.position.set(Math.cos(a) * d, 4.2, Math.sin(a) * d);
    sh.rotation.z = 0.35;
    sh.userData.p = k;
    root.add(sh);
    shafts.push(sh);
  }

  // Sign at the edge facing the island.
  const toCenter = new THREE.Vector3(-fx, 0, -fz).normalize();
  const signPos = toCenter.clone().multiplyScalar(R + 1.5);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 6), bark);
  post.position.set(signPos.x, 1.2, signPos.z);
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 0.12), [bark, bark, bark, bark, new THREE.MeshStandardMaterial({ map: textCanvas(FOREST.name, { w: 512, h: 120, bg: '#f3ead2', fg: '#2f5a2c', size: 50, radius: 14 }) }), bark]);
  board.position.set(signPos.x, 2.2, signPos.z);
  board.rotation.y = Math.atan2(toCenter.x, toCenter.z);
  root.add(post, board);

  // ---- the animals ----
  const builders = { panda: giantPanda, redpanda: redPanda, leopard: snowLeopard, kakapo, pangolin };
  const facing = { panda: Math.atan2(-SPOT.panda.x, -SPOT.panda.z), redpanda: Math.PI / 2, leopard: Math.atan2(-SPOT.leopard.x, -SPOT.leopard.z) };
  const animals = ANIMALS.map((def) => {
    const a = builders[def.id]();
    const spot = SPOT[def.id];
    a.group.scale.setScalar(def.id === 'kakapo' || def.id === 'pangolin' ? 1.1 : 1.15);
    if (a.setHome) a.setHome(spot);
    else {
      a.group.position.copy(spot);
      a.group.rotation.y = facing[def.id] ?? 0;
    }
    a.group.visible = false;
    root.add(a.group);
    return { def, ...a, spot, misses: 0, seen: false };
  });

  // ---- macaws in the canopy ----
  const perches = trees.filter((_, i) => i % 3 === 0).map((t) => new THREE.Vector3(t.x + 1.2, 5.2 + (t.x % 1), t.z));
  const parrots = ['scarlet', 'blue', 'scarlet', 'blue', 'scarlet'].map((kind, i) => {
    const p = macaw(kind);
    p.group.scale.setScalar(1.6);
    const perch = perches[(i * 3) % perches.length];
    p.group.position.copy(perch);
    root.add(p.group);
    return { ...p, perch, from: new THREE.Vector3(), to: perch.clone(), k: 1, wait: 2 + rand() * 8 };
  });

  // ---- sound: songbirds, macaw squawks, doves by day and owls at night ----
  let ac = null;
  const audio = () => (ctx.soundOn() ? (ac ??= ctx.getAudio()) : null);
  const tone = (type, f0, f1, start, dur, vol, out) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(f1, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out ?? ac.destination);
    o.start(start);
    o.stop(start + dur + 0.02);
  };
  const songbird = (vol) => {
    const t0 = ac.currentTime + 0.02;
    const base = 2200 + Math.random() * 1800;
    const n = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const f = base * (0.85 + Math.random() * 0.4);
      tone('sine', f, f * (Math.random() < 0.5 ? 1.35 : 0.7), t0 + i * 0.09, 0.07, vol * 0.05);
    }
  };
  const squawk = (vol) => {
    const t0 = ac.currentTime + 0.02;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 1.4;
    bp.connect(ac.destination);
    tone('sawtooth', 900, 520, t0, 0.32, vol * 0.12, bp);
    tone('square', 1300, 700, t0 + 0.02, 0.25, vol * 0.05, bp);
  };
  const dove = (vol) => {
    const t0 = ac.currentTime + 0.02;
    [[620, 0.35], [520, 0.5], [560, 0.3]].reduce((t, [f, d]) => (tone('sine', f, f * 0.94, t, d, vol * 0.05), t + d + 0.05), t0);
  };
  const owl = (vol) => {
    const t0 = ac.currentTime + 0.02;
    tone('sine', 380, 330, t0, 0.45, vol * 0.07);
    tone('sine', 360, 320, t0 + 0.7, 0.6, vol * 0.07);
  };
  let nextBird = 1;
  let nextCall = 4;

  let inside = false;
  let lastLeft = -999;
  const toLocal = new THREE.Vector3();
  const roll = (night) => {
    animals.forEach((a) => {
      const allowed = a.def.when === 'any' || night;
      // Rarer animals get likelier with each visit you miss them, so everyone can find them in time.
      const show = allowed && Math.random() < a.def.chance + a.misses * 0.15;
      a.group.visible = show;
      a.seen = false;
      if (allowed) a.misses = show ? 0 : a.misses + 1;
    });
  };

  return {
    // Things that move: keep the snow-cover shader off them.
    movers: [...animals.map((a) => a.group), ...parrots.map((p) => p.group)],
    center: { x: fx, z: fz },
    // For testing: show every animal (including the night-only ones).
    showAll() {
      animals.forEach((a) => {
        a.group.visible = true;
        a.seen = false;
      });
    },
    update(dt, t, player, night, camPos) {
      const d = Math.hypot(player.x - fx, player.z - fz);
      if (d < R + 4 && !inside) {
        inside = true;
        if (t - lastLeft > 12) roll(night);
        ctx.onEnter();
      } else if (d > R + 12 && inside) {
        inside = false;
        lastLeft = t;
        animals.forEach((a) => (a.group.visible = false));
      }
      toLocal.set(player.x - fx, 0, player.z - fz);
      animals.forEach((a) => {
        if (!a.group.visible) return;
        const ap = a.group.position;
        const dist = Math.hypot(toLocal.x - ap.x, toLocal.z - ap.z);
        // The snow leopard turns its head to watch you when you get close.
        const toPlayer = dist < 6 ? Math.atan2(toLocal.x - ap.x, toLocal.z - ap.z) - a.group.rotation.y : null;
        a.update(dt, t, toPlayer !== null ? Math.atan2(Math.sin(toPlayer), Math.cos(toPlayer)) : null);
        if (dist < 6.5 && !a.seen) {
          a.seen = true;
          ctx.onSpot(a.def, world(ap));
        }
      });
      // Cut-away canopy: crowns near Byte fade out so the forest floor (and its animals) stay visible
      // from the overhead camera, then fill back in as you walk on.
      // Line of sight on the ground: from Byte toward the camera.
      const sx = camPos.x - fx - toLocal.x;
      const sz = camPos.z - fz - toLocal.z;
      const sl = Math.hypot(sx, sz) || 1;
      crowns.forEach((c, i) => {
        const px = c.position.x - toLocal.x;
        const pz = c.position.z - toLocal.z;
        const along = THREE.MathUtils.clamp((px * sx + pz * sz) / sl, 0, Math.min(sl, 22));
        const near = Math.min(Math.hypot(px, pz) * 0.75, Math.hypot(px - (sx / sl) * along, pz - (sz / sl) * along));
        const goal = inside ? THREE.MathUtils.smoothstep(near, 4.5, 9.5) * 0.88 + 0.12 : 1;
        const m = c.userData.mat;
        m.opacity += (goal - m.opacity) * Math.min(1, dt * 4);
        const fading = m.opacity < 0.98;
        if (m.transparent !== fading) {
          m.transparent = fading;
          m.depthWrite = !fading;
          m.needsUpdate = true;
        }
      });
      shafts.forEach((s) => {
        s.lookAt(player.x, 4.2, player.z); // lookAt takes world coordinates
        s.rotateZ(0.35);
        s.material.opacity = night ? 0 : 0.28 + Math.sin(t * 0.5 + s.userData.p) * 0.12;
      });
      // Macaws hop between trees in short, flapping arcs.
      parrots.forEach((p) => {
        if (p.k < 1) {
          p.k = Math.min(1, p.k + dt / 3);
          const k = p.k;
          p.group.position.lerpVectors(p.from, p.to, k);
          p.group.position.y += Math.sin(k * Math.PI) * 3;
          p.group.rotation.y = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z);
          p.pose(t, true);
        } else {
          p.pose(t, false);
          if ((p.wait -= dt) < 0) {
            p.from.copy(p.group.position);
            p.to.copy(perches[Math.floor(Math.random() * perches.length)]);
            p.k = 0;
            p.wait = 5 + Math.random() * 10;
            if (inside && audio()) squawk(Math.max(0.2, 1 - d / (R + 15)));
          }
        }
      });
      // Ambience fades in as you approach the trees.
      const near = THREE.MathUtils.clamp(1 - (d - R) / 15, 0, 1);
      if (near > 0 && audio()) {
        if ((nextBird -= dt) < 0) {
          nextBird = night ? 6 + Math.random() * 8 : 0.6 + Math.random() * 2.2;
          if (!night) songbird(near);
        }
        if ((nextCall -= dt) < 0) {
          nextCall = 6 + Math.random() * 9;
          if (night) owl(near);
          else if (Math.random() < 0.6) dove(near);
          else squawk(near * 0.7);
        }
      }
    },
  };
}
