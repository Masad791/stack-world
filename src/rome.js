import * as THREE from 'three';
import { paint, rng, std, floatingBase, label, makeGate, bubbleSprite, noise3 } from './realmkit.js';
import { bubbleTexture } from './npc.js';
import { textCanvas } from './world.js';

// The Roman Forum: a separate floating world with the Colosseum, the Pantheon, an aqueduct, the
// Temple of Saturn, the Arch of Titus... and Diogenes, sitting in front of his jar in the sun.

const SPOTS = [
  { id: 'forum', x: 0, z: 0, r: 7, kicker: 'Roman Forum', title: 'The heart of Rome',
    text: 'For centuries this was the centre of Roman life: temples, law courts, speeches and triumphal processions all happened here. After the empire fell, the Forum was buried under so much earth that it became a cow pasture, known as the Campo Vaccino.' },
  { id: 'colosseum', x: 19, z: -9, r: 5, kicker: 'Roman Forum // Landmark', title: 'The Colosseum',
    text: 'Built between AD 70 and 80 under the emperors Vespasian and Titus, it held around 50,000 spectators for gladiator fights and animal hunts. An earthquake in 1349 and centuries of stone robbing took away much of the southern side, which is why it looks broken today.' },
  { id: 'pantheon', x: -20, z: -6, r: 5, kicker: 'Roman Forum // Landmark', title: 'The Pantheon',
    text: 'Rebuilt by the emperor Hadrian around AD 125, its dome is still the largest unreinforced concrete dome in the world, about 43 metres across and exactly as tall inside as it is wide. All of its light comes through the oculus, an open hole about 8 metres wide at the top.' },
  { id: 'aqueduct', x: 0, z: -40, r: 6, kicker: 'Roman Forum // Engineering', title: 'The aqueducts',
    text: 'Rome was supplied by eleven aqueducts. They carried water using only gravity, sloping down so gently over dozens of kilometres that the drop is hard to see. The first, the Aqua Appia, opened in 312 BC.' },
  { id: 'arch', x: 0, z: 30, r: 5, kicker: 'Roman Forum // Monument', title: 'The Arch of Titus',
    text: 'Built around AD 81 to honour the emperor Titus. Its carved panels show soldiers carrying treasures from the Temple in Jerusalem after the siege of AD 70. It inspired triumphal arches all over the world, including the Arc de Triomphe in Paris.' },
];
export const DIOGENES = {
  kicker: 'Philosopher // c. 412 to 323 BC',
  title: 'Diogenes of Sinope',
  text: 'A Greek philosopher and the most famous of the Cynics (from the Greek for "dog-like", because they lived simply and shamelessly in public). He owned almost nothing and slept in a large clay jar in Athens. He walked around in daylight with a lamp, saying he was looking for an honest man.\n\nWhen Alexander the Great stood over him and offered him anything he wished, Diogenes answered: "Stand a little out of my sun." Alexander is said to have replied: "If I were not Alexander, I would wish to be Diogenes."\n\n(He was Greek, not Roman, but Roman writers loved retelling his stories.)',
};

// A Roman: sandals, tunic, a toga draped over one shoulder - or, for a legionary, segmented armour,
// a crested helmet, a red cloak, a curved shield and a javelin.
function roman({ cloth = '#ece5d3', skin = '#c9946b', hair = '#3a2a1e', soldier = false } = {}) {
  const g = new THREE.Group();
  const skinM = std(skin, { roughness: 0.7 });
  const clothM = std(soldier ? '#a8322a' : cloth, { roughness: 0.95 });
  const metal = std('#9aa1a8', { metalness: 0.8, roughness: 0.35 });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, 0.95, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10), skinM);
    leg.position.y = -0.45;
    const sandal = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.27), std('#6b4a2e'));
    sandal.position.set(0, -0.9, 0.04);
    hip.add(leg, sandal);
    g.add(hip);
    return hip;
  });
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, soldier ? 0.33 : 0.36, soldier ? 0.45 : 0.75, 18, 1, true), std(soldier ? '#a8322a' : cloth, { roughness: 0.95, side: THREE.DoubleSide }));
  skirt.position.y = soldier ? 1.0 : 0.85 + 0.37;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.55, 18), soldier ? metal : clothM);
  chest.position.y = 1.47;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), soldier ? metal : clothM);
  shoulders.scale.y = 0.45;
  shoulders.position.y = 1.73;
  g.add(skirt, chest, shoulders);
  if (soldier) {
    // Lorica segmentata: overlapping iron bands.
    for (let k = 0; k < 4; k++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.025, 6, 24), std('#7d858d', { metalness: 0.8, roughness: 0.4 }));
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.25 + k * 0.12;
      g.add(band);
    }
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.2, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), std('#8f2620', { side: THREE.DoubleSide, roughness: 0.95 }));
    cloak.position.y = 1.15;
    g.add(cloak);
  } else {
    // The toga: a broad sash wrapped diagonally over the left shoulder and hanging down the back.
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 24), clothM);
    sash.rotation.set(Math.PI / 2, 0.6, 0);
    sash.position.y = 1.45;
    sash.scale.set(1, 0.9, 1);
    const fall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.06), clothM);
    fall.position.set(-0.14, 1.15, -0.24);
    fall.rotation.x = 0.08;
    g.add(sash, fall);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 10), skinM);
  neck.position.y = 1.82;
  const head = new THREE.Group();
  head.position.y = 2.0;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), skinM));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), skinM);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.01, 0.17);
  head.add(nose);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), std('#2a1d14'));
    eye.position.set(s * 0.06, 0.03, 0.14);
    head.add(eye);
  });
  if (soldier) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), metal);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 20, Math.PI), metal);
    brim.rotation.set(Math.PI / 2, 0, Math.PI);
    brim.position.set(0, -0.02, -0.02);
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 16, Math.PI), std('#c2271f', { roughness: 1 }));
    crest.rotation.y = Math.PI / 2;
    crest.scale.set(1, 1.1, 1.6);
    crest.position.y = 0.1;
    head.add(helm, brim, crest);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.168, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), std(hair, { roughness: 1 }));
    cap.rotation.x = -0.25;
    head.add(cap);
  }
  g.add(neck, head);
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.32, 1.7, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.55, 4, 8), soldier || s > 0 ? skinM : clothM);
    arm.position.y = -0.33;
    sh.add(arm);
    sh.rotation.z = s * 0.08;
    g.add(sh);
    return sh;
  });
  if (soldier) {
    // Scutum: a tall curved shield, red with a gold boss; and a pilum.
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.15, 16, 1, true, -0.45, 0.9), std('#b02a22', { side: THREE.DoubleSide, roughness: 0.6 }));
    shield.rotation.y = Math.PI / 2 + Math.PI;
    shield.position.set(-0.42 - 0.8, 1.2, 0.1);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), std('#d4a83a', { metalness: 0.8, roughness: 0.3 }));
    boss.position.set(-0.43, 1.2, 0.1);
    const pilum = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), std('#6b4a2e'));
    pilum.position.set(0.4, 1.4, 0.15);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.35, 6), metal);
    tip.position.set(0.4, 2.65, 0.15);
    g.add(shield, boss, pilum, tip);
    arms[1].rotation.x = -0.5;
  }
  g.traverse((m) => m.isMesh && (m.castShadow = true));
  return { group: g, legs, arms, head };
}

export function buildRome({ scene, origin, addCollider }) {
  const R = 64;
  const root = new THREE.Group();
  root.position.set(origin.x, 0, origin.z);
  scene.add(root);
  const col = (x, z, r) => addCollider(origin.x + x, origin.z + z, r);
  const rand = rng(31);
  const put = (mesh, x, y, z, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // ---------- ground: dry Mediterranean grass, paved forum, the Via Sacra ----------
  const ground = paint(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b3ab72';
    g.fillRect(0, 0, w, h);
    const r = rng(4);
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(130,120,70,0.25)' : 'rgba(210,200,150,0.25)';
      g.beginPath();
      g.arc(r() * w, r() * h, 2 + r() * 14, 0, Math.PI * 2);
      g.fill();
    }
  });
  floatingBase(root, R, new THREE.MeshStandardMaterial({ map: ground, roughness: 1 }), ['#c9b18a', '#a8957a', '#8e8274', '#77706a']);
  const slabs = paint(512, 512, (g, w, h) => {
    g.fillStyle = '#b9ae98';
    g.fillRect(0, 0, w, h);
    const r = rng(8);
    for (let y = 0; y < h; y += 64) {
      for (let x = -(y % 128 ? 40 : 0); x < w; x += 80 + r() * 30) {
        const s = 205 + Math.floor(r() * 30);
        g.fillStyle = `rgb(${s},${s - 8},${s - 22})`;
        g.fillRect(x + 3, y + 3, 74 + r() * 20, 58);
      }
    }
  }, true);
  slabs.repeat.set(5, 5);
  put(new THREE.Mesh(new THREE.CircleGeometry(19, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: slabs, roughness: 0.9 })), 0, 0.03, 0, false);
  const road = slabs.clone();
  road.repeat.set(1, 8);
  road.needsUpdate = true;
  put(new THREE.Mesh(new THREE.PlaneGeometry(6, 36).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: road, roughness: 0.9 })), 0, 0.025, 36, false);

  const marble = std('#ece6da', { roughness: 0.55 });
  // Travertine: courses of pale blocks with pitted pores; Roman brick: thin red bricks in mortar.
  const travTex = paint(512, 512, (g, w, h) => {
    g.fillStyle = '#d9ccb0';
    g.fillRect(0, 0, w, h);
    const r = rng(12);
    for (let y = 0; y < h; y += 64) {
      for (let x = (y / 64) % 2 ? -60 : 0; x < w; x += 120) {
        const s = 200 + Math.floor(r() * 30);
        g.fillStyle = `rgb(${s + 14},${s + 4},${s - 18})`;
        g.fillRect(x + 2, y + 2, 116, 60);
      }
    }
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() < 0.7 ? 'rgba(120,100,70,0.35)' : 'rgba(255,250,235,0.4)';
      g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 1.5);
    }
  }, true);
  travTex.repeat.set(0.4, 0.4);
  const brickTex = paint(256, 256, (g, w, h) => {
    g.fillStyle = '#b8a48a';
    g.fillRect(0, 0, w, h);
    const r = rng(14);
    for (let y = 0; y < h; y += 16) {
      for (let x = (y / 16) % 2 ? -24 : 0; x < w; x += 48) {
        const k = r();
        g.fillStyle = `rgb(${170 + k * 40},${100 + k * 30},${70 + k * 20})`;
        g.fillRect(x + 2, y + 2, 44, 12);
      }
    }
  }, true);
  brickTex.repeat.set(0.5, 0.5);
  const travertine = new THREE.MeshStandardMaterial({ map: travTex, color: '#fff0d8', roughness: 0.85 });
  const archStone = new THREE.MeshStandardMaterial({ map: travTex, color: '#fffaf0', roughness: 0.7 });
  const travDark = new THREE.MeshStandardMaterial({ map: travTex, color: '#c9b893', roughness: 0.9 });
  const brick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9 });

  // A Roman column: base, slightly tapered shaft with faceted "flutes", capital.
  const column = (x, z, h = 7, r = 0.45, mat = marble, parent = root) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.45, 0.35, 16), mat);
    base.position.y = 0.17;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r, h, 16), mat);
    shaft.position.y = h / 2 + 0.3;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, 0.45, r * 2.6), mat);
    cap.position.y = h + 0.5;
    [base, shaft, cap].forEach((m) => {
      m.castShadow = true;
      g.add(m);
    });
    parent.add(g);
    return g;
  };
  const inscription = (text, w, h) => paint(1024, 96, (g) => {
    g.fillStyle = '#e6dfd0';
    g.fillRect(0, 0, 1024, 96);
    g.fillStyle = '#5a5245';
    g.font = '600 46px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 512, 50, 990);
  });

  // ---------- Temple of Saturn: eight columns still standing on their podium ----------
  {
    const tx = -8;
    const tz = -12;
    put(new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 6), travDark), tx, 1.1, tz);
    for (let i = 0; i < 6; i++) column(tx - 5.5 + i * 2.2, tz + 2.2, 8.5, 0.5, std('#c7c0b2', { roughness: 0.6 }));
    column(tx - 5.5, tz - 0.4, 8.5, 0.5, std('#c7c0b2', { roughness: 0.6 }));
    column(tx + 5.5, tz - 0.4, 8.5, 0.5, std('#c7c0b2', { roughness: 0.6 }));
    root.children.slice(-8).forEach((c) => (c.position.y = 2.2));
    const frieze = new THREE.Mesh(new THREE.BoxGeometry(13.6, 1.4, 3.6), [marble, marble, marble, marble, new THREE.MeshStandardMaterial({ map: inscription('SENATVS POPVLVSQVE ROMANVS INCENDIO CONSVMPTVM RESTITVIT') }), marble]);
    put(frieze, tx, 12, tz + 1);
    col(tx, tz, 5);
    col(tx - 4.5, tz, 3);
    col(tx + 4.5, tz, 3);
  }

  // ---------- broken columns and fallen drums around the forum ----------
  [[10, -14, 3], [14, -11, 1.8], [-14, 4, 4.5], [-12, 9, 2.2], [12, 8, 1.2]].forEach(([x, z, h]) => {
    column(x, z, h, 0.5, marble);
    col(x, z, 0.8);
  });
  [[8, 14, 0.3], [-6, 15, 1.2]].forEach(([x, z, a]) => {
    const drum = put(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 16), marble), x, 0.5, z);
    drum.rotation.set(0, a, Math.PI / 2);
    col(x, z, 0.9);
  });

  // ---------- an orator's statue on a plinth ----------
  {
    const sx = 7;
    const sz = -3;
    put(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.2), travertine), sx, 1.3, sz);
    const bronze = std('#5e7a6a', { roughness: 0.45, metalness: 0.5 });
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.4, 12), bronze), sx, 3.8, sz);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), bronze), sx, 5.3, sz);
    const arm = put(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.9, 4, 8), bronze), sx + 0.35, 5.0, sz + 0.3);
    arm.rotation.set(-1.0, 0, -0.5); // raised, addressing the crowd
    col(sx, sz, 1.6);
  }

  // ---------- Arch of Titus over the Via Sacra ----------
  {
    const az = 30;
    [-3.4, 3.4].forEach((x) => put(new THREE.Mesh(new THREE.BoxGeometry(3, 9, 4), archStone), x, 4.5, az));
    put(new THREE.Mesh(new THREE.BoxGeometry(9.8, 3.4, 4), archStone), 0, 10.7, az);
    const vault = put(new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 4, 24, 1, true, 0, Math.PI), std('#d9d2c2', { side: THREE.DoubleSide })), 0, 9, az);
    vault.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    [-1, 1].forEach((s) => [-2.2, 2.2].forEach((dz) => column(s * 4.6, az + dz * 0.95, 7, 0.32, marble)));
    const att = new THREE.Mesh(new THREE.BoxGeometry(9.8, 1.6, 4.05), [marble, marble, marble, marble, new THREE.MeshStandardMaterial({ map: inscription('SENATVS POPVLVSQVE ROMANVS DIVO TITO') }), marble]);
    put(att, 0, 12.6, az);
    [-3.4, 3.4].forEach((x) => {
      col(x - 0.8, az, 1.6);
      col(x + 0.8, az, 1.6);
    });
  }

  // ---------- the Colosseum ----------
  {
    const cx = 34;
    const cz = -14;
    const A = 21;
    const B = 17;
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    root.add(g);
    const entrance = Math.atan2(-cz / B, -cx / A); // faces the forum
    const gapHalf = 0.16;
    const inGap = (t) => Math.abs(Math.atan2(Math.sin(t - entrance), Math.cos(t - entrance))) < gapHalf;
    // South side in ruins: the outer ring is broken there, as in the real thing.
    const ruinTop = (t) => {
      const d = Math.abs(Math.atan2(Math.sin(t - Math.PI / 2), Math.cos(t - Math.PI / 2)));
      return d < 0.9 ? Math.max(1, Math.round(1 + (d / 0.9) * 2.6)) : 4;
    };
    // Facade: per tier, a travertine wall with a real arched opening, an engaged half-column on each
    // pier and a cornice; a solid attic on top. The panels share geometry, so the whole ring batches.
    const N = 52;
    const tierH = 4.2;
    const W = 2.4;
    const D = 1.6;
    const outline = new THREE.Shape();
    outline.moveTo(-W / 2, 0);
    outline.lineTo(-0.72, 0);
    outline.lineTo(-0.72, 2.45);
    outline.absarc(0, 2.45, 0.72, Math.PI, 0, true);
    outline.lineTo(0.72, 0);
    outline.lineTo(W / 2, 0);
    outline.lineTo(W / 2, tierH);
    outline.lineTo(-W / 2, tierH);
    outline.closePath();
    const arcade = new THREE.ExtrudeGeometry(outline, { depth: D, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -D / 2);
    const attic = new THREE.BoxGeometry(W, 3, D * 0.9).translate(0, 1.5, 0);
    const cornice = new THREE.BoxGeometry(W, 0.24, D + 0.3);
    const halfCol = new THREE.CylinderGeometry(0.24, 0.26, tierH - 0.5, 12, 1, false, -Math.PI / 2, Math.PI);
    const ell = (t) => new THREE.Vector2(Math.cos(t) * A, Math.sin(t) * B);
    for (let i = 0; i < N; i++) {
      const t0 = (i / N) * Math.PI * 2;
      const t1 = ((i + 1) / N) * Math.PI * 2;
      const tm = (t0 + t1) / 2;
      if (inGap(tm)) continue;
      const p0 = ell(t0);
      const p1 = ell(t1);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const chord = p0.distanceTo(p1);
      const nrm = new THREE.Vector2(Math.cos(tm) / A, Math.sin(tm) / B).normalize();
      const tiers = ruinTop(tm);
      const bay = new THREE.Group();
      bay.position.set(mid.x, 0, mid.y);
      bay.rotation.y = Math.atan2(nrm.x, nrm.y); // local +z faces outward, local x runs along the ring
      for (let k = 0; k < Math.min(3, tiers); k++) {
        const y0 = k * tierH;
        const wall = new THREE.Mesh(arcade, travertine);
        wall.position.y = y0;
        wall.scale.x = chord / W + 0.02;
        const c = new THREE.Mesh(halfCol, travDark);
        c.position.set(-chord / 2, y0 + (tierH - 0.5) / 2, D / 2);
        const band = new THREE.Mesh(cornice, travDark);
        band.position.y = y0 + tierH - 0.12;
        band.scale.x = chord / W + 0.04;
        [wall, c, band].forEach((m) => {
          m.castShadow = true;
          m.receiveShadow = true;
          bay.add(m);
        });
      }
      if (tiers >= 4) {
        const a = new THREE.Mesh(attic, travertine);
        a.position.y = 3 * tierH;
        a.scale.x = chord / W + 0.02;
        a.castShadow = true;
        bay.add(a);
        if (i % 2) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.1), std('#3b342c'));
          win.position.set(0, 3 * tierH + 1.4, D * 0.45 + 0.01);
          bay.add(win);
        }
      }
      g.add(bay);
      col(cx + mid.x, cz + mid.y, 1.2);
    }
    // Seating: stepped tiers rising from the arena wall to the outer ring (a lathe, squashed into an ellipse),
    // with a wedge left open as the entrance passage.
    const prof = [new THREE.Vector2(8.6, 0), new THREE.Vector2(8.6, 2.4)];
    for (let k = 0; k < 11; k++) {
      prof.push(new THREE.Vector2(8.6 + k * 1.0, 2.4 + k * 0.85 + 0.85));
      prof.push(new THREE.Vector2(8.6 + (k + 1) * 1.0, 2.4 + k * 0.85 + 0.85));
    }
    prof.push(new THREE.Vector2(A - 0.6, 0));
    const lathe = new THREE.LatheGeometry(prof, 72, Math.PI / 2 - entrance + gapHalf * 1.2, Math.PI * 2 - gapHalf * 2.4);
    const cavea = new THREE.Mesh(lathe, std('#c9bb9c', { flatShading: true, side: THREE.DoubleSide }));
    cavea.scale.set(1, 1, B / A);
    cavea.castShadow = true;
    cavea.receiveShadow = true;
    g.add(cavea);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(8.6, 48).rotateX(-Math.PI / 2), std('#d8c08a'));
    sand.scale.set(1, 1, B / A);
    sand.position.y = 0.04;
    sand.receiveShadow = true;
    g.add(sand);
    // Keep Byte out of the seating except through the entrance.
    for (let rr = 9.6; rr < A; rr += 1.6) {
      const n = Math.ceil((2 * Math.PI * rr) / 1.6);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        if (inGap(t)) continue;
        col(cx + Math.cos(t) * rr, cz + Math.sin(t) * rr * (B / A), 1.0);
      }
    }
    const sign = label('Colosseum', '#8a4526');
    sign.position.set(cx, 18, cz);
    root.add(sign);
  }

  // ---------- the Pantheon ----------
  {
    const px = -32;
    const pz = -4;
    const face = Math.atan2(-px, -pz); // portico faces the forum
    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    g.rotation.y = face;
    root.add(g);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.3, 8.5, 48), brick);
    drum.position.y = 4.25;
    const steps = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.8, 1.2, 48), travDark);
    steps.position.y = 9;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9.2, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), std('#a9a69f', { roughness: 0.6 }));
    dome.scale.y = 0.55;
    dome.position.y = 9.3;
    const oculus = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 24), std('#2a2724'));
    oculus.position.y = 9.3 + 9.2 * 0.55 - 0.05;
    const block = new THREE.Mesh(new THREE.BoxGeometry(11, 10, 3), brick);
    block.position.set(0, 5, 9.6);
    [drum, steps, dome, oculus, block].forEach((m) => {
      m.castShadow = true;
      g.add(m);
    });
    // Portico: two rows of granite columns, a frieze with Agrippa's inscription, a pediment.
    const granite = std('#a8a39b', { roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      column(-6.3 + i * 1.8, 15.6, 8.5, 0.48, granite, g);
      if (i % 7 === 0 || i === 3 || i === 4) column(-6.3 + i * 1.8, 12.6, 8.5, 0.48, granite, g);
    }
    const fr = new THREE.Mesh(new THREE.BoxGeometry(15, 1.6, 4.4), [marble, marble, marble, marble, new THREE.MeshStandardMaterial({ map: inscription('M · AGRIPPA · L · F · COS · TERTIVM · FECIT') }), marble]);
    fr.position.set(0, 10.1, 14.2);
    fr.castShadow = true;
    g.add(fr);
    const ped = new THREE.Shape();
    ped.moveTo(-7.6, 0);
    ped.lineTo(7.6, 0);
    ped.lineTo(0, 3.2);
    ped.closePath();
    const pediment = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 4.4, bevelEnabled: false }), marble);
    pediment.position.set(0, 10.9, 12);
    pediment.castShadow = true;
    g.add(pediment);
    col(px, pz, 9.6);
    const front = new THREE.Vector3(0, 0, 13).applyAxisAngle(THREE.Object3D.DEFAULT_UP, face);
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(-6.3 + i * 1.8, 0, 15.6).applyAxisAngle(THREE.Object3D.DEFAULT_UP, face);
      col(px + v.x, pz + v.z, 0.7);
    }
    col(px + front.x, pz + front.z, 4.2);
    const sign = label('Pantheon', '#8a4526');
    sign.position.set(px, 18, pz);
    root.add(sign);
  }

  // ---------- the aqueduct across the north ----------
  {
    const az = -46;
    const span = 4;
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const x = -40 + i * span;
      put(new THREE.Mesh(new THREE.BoxGeometry(1.3, 9, 1.8), brick), x, 4.5, az);
      put(new THREE.Mesh(new THREE.BoxGeometry(1.0, 6, 1.5), brick), x, 12, az);
      col(x, az, 1.1);
      if (i < n) {
        const a1 = put(new THREE.Mesh(new THREE.TorusGeometry(span / 2 - 0.62, 0.32, 6, 14, Math.PI), brick), x + span / 2, 9 - (span / 2 - 0.62), az);
        a1.scale.z = 2.4;
        const a2 = put(new THREE.Mesh(new THREE.TorusGeometry(span / 2 - 0.5, 0.26, 6, 14, Math.PI), brick), x + span / 2, 15 - (span / 2 - 0.5), az);
        a2.scale.z = 2.2;
      }
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(span * n + 1.3, 1.6, 2.2), brick), 0, 15.8, az);
    put(new THREE.Mesh(new THREE.BoxGeometry(span * n, 0.25, 1.2), std('#6fb7d6', { roughness: 0.15, metalness: 0.1 })), 0, 16.7, az, false); // the water channel
  }

  // ---------- Diogenes, his jar, his lamp and a dog ----------
  const dio = new THREE.Group();
  const DX = 12;
  const DZ = 12;
  dio.position.set(DX, 0, DZ);
  dio.rotation.y = Math.atan2(-DX, -DZ) + 0.5;
  root.add(dio);
  {
    const clay = std('#b5623a', { roughness: 0.9 });
    const prof = [[0.0, 0], [1.2, 0.25], [1.75, 1.2], [1.85, 2.1], [1.6, 3.0], [1.0, 3.55], [0.85, 3.75], [0.95, 3.9]].map(([r, y]) => new THREE.Vector2(r, y));
    const jar = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), new THREE.MeshStandardMaterial({ color: '#b5623a', roughness: 0.9, side: THREE.DoubleSide }));
    jar.rotation.z = Math.PI / 2; // lying on its side, mouth facing forward
    jar.rotation.y = Math.PI / 2;
    jar.position.set(0, 1.85, -4.6);
    jar.castShadow = true;
    dio.add(jar);
    [1.0, 2.4].forEach((y) => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.06, 6, 32), std('#8a4526'));
      band.position.set(0, 1.85, -4.6 + y);
      dio.add(band);
    });
    col(DX + Math.sin(dio.rotation.y) * -3, DZ + Math.cos(dio.rotation.y) * -3, 2.2);
    col(DX, DZ, 1.0);
  }
  const skin = std('#c9946b', { roughness: 0.7 });
  const robe = std('#e6dbc2', { roughness: 0.95 });
  const hair = std('#ebe8e1', { roughness: 0.9 });
  const body = new THREE.Group();
  body.position.set(0, 0, -0.6);
  dio.add(body);
  // Seated on the ground: crossed legs under the robe, torso, one bare shoulder.
  body.add(Object.assign(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 6, 12), robe), { castShadow: true }).translateY(0.35).rotateZ(Math.PI / 2));
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.55, 1.1, 16), robe);
  torso.position.y = 1.05;
  torso.castShadow = true;
  body.add(torso);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
  shoulder.position.set(0.32, 1.5, 0);
  body.add(shoulder);
  [-1, 1].forEach((s) => {
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), skin);
    foot.position.set(s * 0.35, 0.12, 0.45);
    foot.rotation.x = Math.PI / 2;
    body.add(foot);
  });
  const armL = new THREE.Group();
  armL.position.set(-0.36, 1.45, 0);
  armL.add(Object.assign(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 4, 8), robe), { castShadow: true }).translateY(-0.35));
  armL.rotation.set(-0.7, 0, 0.3);
  const armR = new THREE.Group();
  armR.position.set(0.38, 1.45, 0);
  armR.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.6, 4, 8), skin).translateY(-0.35));
  armR.rotation.set(-0.9, 0, -0.25);
  body.add(armL, armR);
  const head = new THREE.Group();
  head.position.set(0, 1.95, 0.02);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), skin));
  const fringe = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 18, Math.PI * 1.3), hair);
  fringe.rotation.set(Math.PI / 2, 0, Math.PI * 0.35);
  fringe.position.y = 0.02;
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 12), hair);
  beard.rotation.x = Math.PI;
  beard.position.set(0, -0.32, 0.12);
  const moustache = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), hair);
  moustache.scale.set(1.4, 0.5, 0.6);
  moustache.position.set(0, -0.08, 0.22);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 8), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.0, 0.27);
  head.add(fringe, beard, moustache, nose);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std('#2a1d14', { roughness: 0.2 }));
    eye.position.set(s * 0.09, 0.06, 0.23);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.03), hair);
    brow.position.set(s * 0.09, 0.12, 0.24);
    head.add(eye, brow);
  });
  body.add(head);
  // Staff, and the oil lamp he carried in broad daylight.
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.6, 6), std('#6b4a2e'));
  staff.position.set(-0.9, 1.1, -0.4);
  staff.rotation.z = 0.35;
  dio.add(staff);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), std('#a6582f'));
  lamp.scale.set(1.4, 0.55, 0.9);
  lamp.position.set(0.9, 0.12, 0.5);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9a2e', emissiveIntensity: 2.5 }));
  flame.position.set(1.08, 0.28, 0.5);
  dio.add(lamp, flame);
  // The dog: Cynic means "dog-like", and he was nicknamed "the Dog".
  const dog = new THREE.Group();
  dog.position.set(-1.6, 0, 0.9);
  dog.rotation.y = 0.9;
  const fur = std('#b08a5a', { roughness: 0.95 });
  const dogBody = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), fur);
  dogBody.scale.set(0.9, 0.62, 1.5);
  dogBody.position.y = 0.28;
  const dogHead = new THREE.Group();
  dogHead.position.set(0, 0.35, 0.68);
  dogHead.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), fur));
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), fur);
  snout.scale.set(0.9, 0.8, 1.4);
  snout.position.set(0, -0.06, 0.2);
  const dnose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std('#1d1a18'));
  dnose.position.set(0, -0.03, 0.35);
  dogHead.add(snout, dnose);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), std('#8a6a44'));
    ear.position.set(s * 0.12, 0.17, -0.02);
    ear.rotation.z = -s * 0.4;
    dogHead.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), fur);
  tail.position.set(0, 0.32, -0.75);
  tail.rotation.x = -1.1;
  dog.add(dogBody, dogHead, tail);
  dio.add(dog);
  const bubble = bubbleSprite(bubbleTexture('Stand a little out of my sunlight.'));
  bubble.position.set(DX, 4.2, DZ);
  root.add(bubble);
  const dioName = label('Diogenes', '#8a4526', 5);
  dioName.position.set(DX, 3.2, DZ);
  root.add(dioName);

  // ---------- trees: Italian stone pines and cypresses ----------
  const pineCanopy = std('#4c6b3a', { roughness: 0.9 });
  const pineCanopy2 = std('#3f5d31', { roughness: 0.9 });
  const cypress = std('#2f4a2c', { roughness: 0.9 });
  // Cypress: a slim flame-shaped lathe with knobbly foliage.
  const cypressGeo = (h, seed) => {
    const prof = [[0, 0], [0.55, 0.15], [0.85, h * 0.18], [0.9, h * 0.38], [0.75, h * 0.62], [0.42, h * 0.86], [0.12, h * 0.98], [0, h]].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(prof, 18);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (noise3(p.getX(i) * 3 + seed, p.getY(i) * 1.5, p.getZ(i) * 3) - 0.5) * 0.35;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const bark = std('#7a5a3e');
  const spots = [];
  for (let k = 0; k < 300 && spots.length < 34; k++) {
    const a = rand() * Math.PI * 2;
    const d = 22 + rand() * 38;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.hypot(x - 34, z + 14) < 25 || Math.hypot(x + 32, z + 4) < 15 || Math.abs(z + 46) < 5 || (Math.abs(x) < 6 && z > 15) || Math.hypot(x - DX, z - DZ) < 6 || Math.hypot(x + 14, z - 22) < 8 || Math.hypot(x - 2, z + 26) < 6 || Math.hypot(x + 20, z + 30) < 5 || Math.hypot(x - 14, z - 24) < 5) continue;
    if (spots.some((p) => Math.hypot(p.x - x, p.z - z) < 4.5)) continue;
    spots.push({ x, z });
  }
  // Cypress avenue along the Via Sacra.
  for (let z = 18; z < 56; z += 6) [-5.5, 5.5].forEach((x) => spots.push({ x, z, cyp: true }));
  spots.forEach(({ x, z, cyp }, i) => {
    if (cyp || i % 3 === 0) {
      const h = 7 + rand() * 3;
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.2, 6), bark), x, 0.6, z);
      put(new THREE.Mesh(cypressGeo(h, i * 1.3), cypress), x, 0.9, z).scale.x = 0.85;
      col(x, z, 0.6);
    } else {
      const h = 6 + rand() * 2.5;
      const trunk = put(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, h, 7), bark), x, h / 2, z);
      trunk.rotation.z = (rand() - 0.5) * 0.25;
      for (let k = 0; k < 5; k++) {
        const c = put(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 3), k % 2 ? pineCanopy : pineCanopy2), x + Math.cos(k * 1.3) * 1.6, h + 0.2 + rand() * 0.4, z + Math.sin(k * 1.3) * 1.6);
        c.scale.y = 0.42; // flat "umbrella" top
      }
      col(x, z, 0.6);
    }
  });

  // ---------- market stalls along the Via Sacra ----------
  {
    const awnings = [['#b0342a', '#efe4cc'], ['#2f5f9e', '#efe4cc'], ['#c9902a', '#efe4cc']];
    const stripes = (a, b) => {
      const t = paint(128, 128, (g, w, h) => {
        for (let x = 0; x < w; x += 16) {
          g.fillStyle = (x / 16) % 2 ? a : b;
          g.fillRect(x, 0, 16, h);
        }
      });
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
    };
    const timber = std('#7a5636');
    const clay = std('#b5623a', { roughness: 0.85 });
    const amphora = new THREE.LatheGeometry([[0, 0], [0.08, 0.02], [0.2, 0.3], [0.24, 0.55], [0.17, 0.85], [0.07, 0.95], [0.07, 1.1], [0.1, 1.12]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
    [[-12, 18, 0.25], [-14, 25, 0.1], [14, 25, -0.15]].forEach(([x, z, ry], i) => {
      const st = new THREE.Group();
      st.position.set(x, 0, z);
      st.rotation.y = Math.atan2(-x, 0) + ry;
      root.add(st);
      [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]].forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.6, 6), timber);
        post.position.set(px, 1.3, pz);
        st.add(post);
      });
      const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4, 1, 6), stripes(...awnings[i]));
      const ap = awning.geometry.attributes.position;
      for (let k = 0; k < ap.count; k++) ap.setZ(k, Math.sin(((ap.getY(k) + 1.2) / 2.4) * Math.PI) * 0.18);
      awning.geometry.computeVertexNormals();
      awning.rotation.x = -Math.PI / 2 + 0.15;
      awning.position.y = 2.65;
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.2), timber);
      table.position.set(0, 0.9, 0.3);
      const front = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 0.06), std('#8e6a46'));
      front.position.set(0, 0.45, 0.88);
      st.add(awning, table, front);
      // Goods: amphorae of oil and wine, baskets of fruit, round loaves.
      for (let k = 0; k < 3; k++) {
        const a = new THREE.Mesh(amphora, clay);
        a.position.set(-1.0 + k * 0.45, 0.95, -0.1);
        a.scale.setScalar(0.55);
        st.add(a);
      }
      const fruit = [['#c4302b', '#e8902a', '#7aa33a'], ['#5a2a6e', '#7aa33a', '#e8c23a'], ['#e8902a', '#c4302b', '#d9b36a']][i];
      [0.4, 1.05].forEach((bx, b) => {
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.16, 14, 1, true), std('#a8844e', { side: THREE.DoubleSide }));
        basket.position.set(bx, 1.03, 0.45);
        st.add(basket);
        for (let f = 0; f < 7; f++) {
          const fr = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), std(fruit[(f + b) % 3], { roughness: 0.5 }));
          fr.position.set(bx + Math.cos(f * 2.4) * 0.14 * (f % 3 ? 1 : 0.3), 1.12 + (f % 3 ? 0 : 0.06), 0.45 + Math.sin(f * 2.4) * 0.14 * (f % 3 ? 1 : 0.3));
          st.add(fr);
        }
      });
      st.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
      col(x, z, 2.0);
    });
  }

  // ---------- a fountain ----------
  const fountainSheet = new THREE.MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.45, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const pool = new THREE.MeshStandardMaterial({ color: '#4f9fb8', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 });
  {
    const FX = 2;
    const FZ = -26;
    const basin = new THREE.LatheGeometry([[3.0, 0], [3.2, 0.1], [3.2, 0.7], [3.0, 0.8], [2.8, 0.8], [2.8, 0.15]].map(([r, y]) => new THREE.Vector2(r, y)), 48);
    put(new THREE.Mesh(basin, travertine), FX, 0, FZ);
    put(new THREE.Mesh(new THREE.CircleGeometry(2.85, 48).rotateX(-Math.PI / 2), pool), FX, 0.55, FZ, false);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 16), travertine), FX, 1.1, FZ);
    const bowl = new THREE.LatheGeometry([[0, 0], [0.9, 0.15], [1.1, 0.45], [1.0, 0.5], [0.85, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
    put(new THREE.Mesh(bowl, travertine), FX, 2.1, FZ);
    // Water spilling over the rim of the bowl in a thin sheet.
    const sheet = new THREE.LatheGeometry([[1.08, 2.55], [1.35, 2.2], [1.6, 1.5], [1.75, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 32, 0, Math.PI * 2);
    put(new THREE.Mesh(sheet, fountainSheet), FX, 0, FZ, false);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), std('#5e7a6a', { metalness: 0.5, roughness: 0.4 })), FX, 2.75, FZ);
    col(FX, FZ, 3.3);
  }

  // ---------- Trajan's Column: a spiral frieze winding to the top ----------
  {
    const TX = -20;
    const TZ = -30;
    put(new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3.4), travertine), TX, 1.5, TZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.5, 24), marble), TX, 3.25, TZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 16, 32), marble), TX, 11.5, TZ);
    const pts = [];
    for (let i = 0; i <= 400; i++) {
      const k = i / 400;
      const a = k * Math.PI * 2 * 12;
      const r = 1.06 - k * 0.1;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 3.6 + k * 15.6, Math.sin(a) * r));
    }
    put(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.06, 5), std('#d9d0be', { roughness: 0.7 })), TX, 0, TZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.4), marble), TX, 19.7, TZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.8, 16), marble), TX, 20.3, TZ);
    const statue = roman({ cloth: '#5e7a6a', skin: '#5e7a6a', hair: '#4e6a5a' });
    statue.group.position.set(TX, 20.7, TZ);
    statue.group.scale.setScalar(1.3);
    statue.group.traverse((m) => m.isMesh && (m.material = std('#5e7a6a', { metalness: 0.55, roughness: 0.4 })));
    root.add(statue.group);
    col(TX, TZ, 2.4);
    const sign = label("Trajan's Column", '#8a4526', 7);
    sign.position.set(TX, 24.5, TZ);
    root.add(sign);
  }

  // ---------- SPQR banners on the Arch, standards at the forum entrance ----------
  const banners = [];
  {
    const spqr = paint(128, 320, (g, w, h) => {
      g.fillStyle = '#9e2a22';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d4a83a';
      g.lineWidth = 6;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#e6c04a';
      g.font = '700 40px Georgia, serif';
      g.textAlign = 'center';
      ['S', 'P', 'Q', 'R'].forEach((c, i) => g.fillText(c, w / 2, 80 + i * 60));
      g.beginPath();
      g.arc(w / 2, 40, 14, 0, Math.PI * 2);
      g.fill();
    });
    const mat = new THREE.MeshStandardMaterial({ map: spqr, side: THREE.DoubleSide, roughness: 0.9 });
    [-1, 1].forEach((side) => [-3.4, 3.4].forEach((x) => {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.8, 1, 8), mat);
      b.geometry.translate(0, -1.9, 0);
      b.position.set(x, 12.3, 30 + side * 2.06);
      b.rotation.y = side > 0 ? 0 : Math.PI;
      root.add(b);
      banners.push(b);
    }));
    [-8, 8].forEach((x) => {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 6, 8), std('#6b4a2e')), x, 3, 18);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), std('#d4a83a', { metalness: 0.8, roughness: 0.3 })), x, 5.3, 18).rotation.z = Math.PI / 2;
      put(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), std('#d4a83a', { metalness: 0.8, roughness: 0.3 })), x, 6.15, 18);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6, 1, 6), mat);
      flag.geometry.translate(0, -0.8, 0);
      flag.position.set(x, 5.25, 18.02);
      root.add(flag);
      banners.push(flag);
      col(x, 18, 0.3);
    });
  }

  // ---------- bronze braziers ----------
  const flames = [];
  {
    const bronze = std('#6e5a3a', { metalness: 0.7, roughness: 0.4 });
    const fire = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff7a1e', emissiveIntensity: 2.4, transparent: true, opacity: 0.9 });
    [[-4, 19], [4, 19], [17, 3], [-17, -12]].forEach(([x, z]) => {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const leg = put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.3, 6), bronze), x + Math.cos(a) * 0.25, 0.62, z + Math.sin(a) * 0.25);
        leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      }
      put(new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bronze), x, 1.5, z);
      const f = put(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 10), fire), x, 1.75, z, false);
      flames.push(f);
      col(x, z, 0.5);
    });
  }

  // ---------- the people of Rome ----------
  // Citizens stroll back and forth; two legionaries stand guard at the Arch.
  const walkers = [
    { from: [-1.5, 20], to: [-1.5, 50], cloth: '#ece5d3', hair: '#2b1e14', speed: 1.0 },
    { from: [1.6, 48], to: [1.6, 21], cloth: '#d9c7a0', hair: '#5a4632', speed: 0.85 },
    { from: [-11, 1.5], to: [11, 1.5], cloth: '#efe9dc', hair: '#8a8580', speed: 0.7 },
    { from: [10, -6], to: [-3, -6], cloth: '#b9cde0', hair: '#2b1e14', speed: 0.9 },
  ].map((w, i) => {
    const r = roman({ cloth: w.cloth, hair: w.hair, skin: ['#c9946b', '#b07a52', '#d9a57c', '#a86f4a'][i] });
    root.add(r.group);
    return { ...w, ...r, k: i * 0.3, dir: 1 };
  });
  const guards = [-7.4, 7.4].map((x) => {
    const r = roman({ soldier: true, skin: '#c08a60' });
    r.group.position.set(x, 0, 33.4);
    root.add(r.group);
    col(x, 33.4, 0.8);
    return r;
  });

  const gate = makeGate(root, 0, 56, Math.PI, 'Sky Gate');
  const nameSign = label('Roman Forum', '#8a4526');
  nameSign.position.set(0, 13, 0);
  root.add(nameSign);

  const world = (s) => ({ ...s, x: origin.x + s.x, z: origin.z + s.z });
  let talkT = 0;
  return {
    id: 'rome',
    group: root,
    bounds: { x: origin.x, z: origin.z, r: R - 3 },
    spawn: { x: origin.x, z: origin.z + 50 },
    gate: { x: origin.x + gate.spot.x, z: origin.z + gate.spot.z },
    env: { cloudSea: true, ocean: false, fog: 1.2, snow: 0 },
    spots: SPOTS.map(world),
    movers: [...walkers.map((w) => w.group), ...guards.map((g) => g.group), dio, bubble, ...banners, ...flames],
    npc: { x: origin.x + DX, z: origin.z + DZ, name: 'Diogenes', info: DIOGENES },
    map: [
      { x: 0, z: 0, r: 19, color: 'rgba(214,201,173,0.9)' },
      { x: 34, z: -14, r: 19, color: 'rgba(187,169,138,0.95)' },
      { x: -32, z: -4, r: 9.5, color: 'rgba(196,155,120,0.95)' },
      { x: 0, z: -46, r: 3, color: 'rgba(196,155,120,0.9)' },
      { x: DX, z: DZ, r: 2.5, color: '#b5623a' },
      { x: gate.spot.x, z: gate.spot.z, r: 2.5, color: '#2f6fe4' },
    ].map(world),
    ground: '#b3ab72',
    update(dt, t, player) {
      // Diogenes: breathes, turns to look at whoever blocks his sun, and says so.
      const lx = player.x - (origin.x + DX);
      const lz = player.z - (origin.z + DZ);
      const near = Math.hypot(lx, lz) < 7;
      head.rotation.y += ((near ? THREE.MathUtils.clamp(Math.atan2(lx, lz) - dio.rotation.y, -0.9, 0.9) : Math.sin(t * 0.3) * 0.3) - head.rotation.y) * Math.min(1, dt * 3);
      torso.scale.y = 1 + Math.sin(t * 1.4) * 0.015;
      talkT = near ? talkT + dt : 0;
      armR.rotation.x = -0.9 - (near ? Math.max(0, Math.sin(talkT * 2.5)) * 0.6 : 0); // a dismissive wave
      bubble.material.opacity += ((near ? 1 : 0) - bubble.material.opacity) * Math.min(1, dt * 6);
      bubble.visible = bubble.material.opacity > 0.02;
      flame.scale.y = 1 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1;
      dogHead.rotation.x = Math.sin(t * 0.4) * 0.12;
      tail.rotation.y = Math.sin(t * (near ? 9 : 2)) * 0.35;
      flames.forEach((f, i) => {
        f.scale.set(1 + Math.sin(t * 9 + i) * 0.08, 1 + Math.sin(t * 13 + i * 2) * 0.18 + Math.sin(t * 7 + i) * 0.1, 1);
        f.rotation.y = t * 2 + i;
      });
      banners.forEach((b, i) => (b.rotation.x = Math.sin(t * 1.6 + i) * 0.06));
      fountainSheet.opacity = 0.4 + Math.sin(t * 6) * 0.05;
      guards.forEach((g, i) => (g.head.rotation.y = Math.sin(t * 0.25 + i * 3) * 0.5));
      walkers.forEach((w) => {
        // Walk to the end of the street, turn round, walk back.
        const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
        w.k += (dt * w.speed * w.dir) / len;
        if (w.k > 1 || w.k < 0) {
          w.k = THREE.MathUtils.clamp(w.k, 0, 1);
          w.dir *= -1;
        }
        const x = w.from[0] + (w.to[0] - w.from[0]) * w.k;
        const z = w.from[1] + (w.to[1] - w.from[1]) * w.k;
        w.group.position.set(x, Math.abs(Math.sin(t * 5 * w.speed)) * 0.03, z);
        w.group.rotation.y = Math.atan2((w.to[0] - w.from[0]) * w.dir, (w.to[1] - w.from[1]) * w.dir);
        const swing = Math.sin(t * 5 * w.speed) * 0.45;
        w.legs[0].rotation.x = swing;
        w.legs[1].rotation.x = -swing;
        w.arms[0].rotation.x = -swing * 0.7;
        w.arms[1].rotation.x = swing * 0.7;
      });
    },
  };
}
