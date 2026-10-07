import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Byte's colours: clean white with navy and a soft blue glow (the portfolio's white + blue theme).
export const BYTE = { shell: 0xf7f9fc, dark: 0x0c2d5e, accent: 0x2f6fe4, glow: 0x7fc4ff };

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, ...extra });

// Every bot is built from primitives (no model files): a chibi robot with a big rounded head, a face
// screen with glowing eyes, and an optional outfit that tells you what it does on the island.
export class Bot {
  // palette: { shell, dark, accent, glow, body? }   outfit: see OUTFITS below   flying: drones hover
  constructor({ palette = BYTE, outfit = null, flying = false } = {}) {
    const p = { ...BYTE, ...palette };
    this.flying = flying;
    this.group = new THREE.Group(); // position + heading
    this.body = new THREE.Group(); // bob, lean, squash
    this.group.add(this.body);

    const shell = std(p.shell);
    const bodyMat = std(p.body ?? p.shell);
    const dark = std(p.dark, { roughness: 0.25, metalness: 0.15 });
    const accent = std(p.accent);
    const glow = new THREE.MeshStandardMaterial({ color: p.glow, emissive: p.glow, emissiveIntensity: 2 });
    this.mats = { shell, bodyMat, dark, accent, glow };
    const cast = (m) => ((m.castShadow = true), m);

    // ---- torso: a soft pebble with a glowing core ----
    const torso = cast(new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.82, 0.78, 5, 0.34), bodyMat));
    torso.position.y = 1.0;
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), glow);
    core.position.set(0, 1.05, 0.395);
    this.core = core;

    // ---- head: big and round (chibi proportions) ----
    this.head = new THREE.Group();
    this.head.position.y = 1.98;
    const skull = cast(new THREE.Mesh(new RoundedBoxGeometry(1.62, 1.28, 1.3, 6, 0.52), shell));
    const screen = new THREE.Mesh(new RoundedBoxGeometry(1.24, 0.78, 0.12, 5, 0.3), dark);
    screen.position.set(0, -0.04, 0.6);
    const eyeGeo = new THREE.CapsuleGeometry(0.11, 0.12, 6, 12);
    const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyes = [-0.27, 0.27].map((x) => {
      const eye = new THREE.Group();
      eye.position.set(x, 0.0, 0.67);
      const iris = new THREE.Mesh(eyeGeo, glow);
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), sparkleMat);
      sparkle.position.set(0.045, 0.07, 0.09);
      eye.add(iris, sparkle);
      return eye;
    });
    // A tiny smile and blush make it read as friendly from far away.
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 16, Math.PI), glow);
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.2, 0.67);
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xffb3c7, transparent: true, opacity: 0.75 });
    const blush = [-0.47, 0.47].map((x) => {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), blushMat);
      b.position.set(x, -0.14, 0.663);
      b.scale.y = 0.6;
      return b;
    });
    // Headphone-style ears.
    const ears = [-0.84, 0.84].flatMap((x) => {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 20), dark);
      ear.rotation.z = Math.PI / 2;
      ear.position.x = x;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 20), accent);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x * 1.09;
      return [ear, ring];
    });
    // Antenna on a springy stalk.
    this.antenna = new THREE.Group();
    this.antenna.position.y = 0.62;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.42), dark);
    stalk.position.y = 0.21;
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), glow.clone());
    this.tip.position.y = 0.46;
    this.antenna.add(stalk, this.tip);
    this.head.add(skull, screen, ...this.eyes, smile, ...blush, ...ears, this.antenna);

    // ---- limbs ----
    const limb = (len, r, mat, handMat) => {
      const pivot = new THREE.Group();
      const mesh = cast(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat));
      mesh.position.y = -len / 2 - r * 0.5;
      pivot.add(mesh);
      if (handMat) {
        const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 12, 10), handMat));
        hand.position.y = -len - r;
        pivot.add(hand);
      }
      pivot.hand = new THREE.Group(); // anchor for held items
      pivot.hand.position.y = -len - r * 1.4;
      pivot.add(pivot.hand);
      return pivot;
    };
    this.arms = [-0.62, 0.62].map((x) => {
      const arm = limb(0.32, 0.12, bodyMat, dark);
      arm.position.set(x, 1.22, 0);
      return arm;
    });
    this.legs = [-0.25, 0.25].map((x) => {
      const leg = limb(0.18, 0.15, dark);
      leg.position.set(x, 0.56, 0);
      const foot = cast(new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.16, 0.44, 3, 0.07), dark));
      foot.position.set(0, -0.42, 0.06);
      leg.add(foot);
      return leg;
    });
    this.body.add(torso, core, this.head, ...this.arms, ...this.legs);

    if (flying) this.#makeDrone();
    if (outfit) OUTFITS[outfit]?.(this, p);

    // Soft blob shadow keeps the bot readable on any surface.
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color: 0x0c1a33, transparent: true, opacity: 0.2, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.03;
    this.blob = blob;
    this.group.add(blob);

    this.vel = new THREE.Vector3();
    this.y = 0;
    this.vy = 0;
    this.phase = 0;
    this.squash = 0;
    this.blinkAt = 2;
    this.antennaLag = 0;
    this.pose = 'stand'; // 'stand' | 'sit'
    this.poseK = 0; // 0 standing .. 1 sitting
    this.lookUp = 0; // 0..1, for stargazing
  }

  // Drones: no legs, four rotors on arms and a glowing underside light.
  #makeDrone() {
    this.legs.forEach((l) => (l.visible = false));
    this.rotors = [];
    const armMat = this.mats.dark;
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f5, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), armMat);
      arm.rotation.order = 'YXZ';
      arm.rotation.y = -Math.atan2(sz, sx);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(sx * 0.45, 2.75, sz * 0.45);
      const hub = new THREE.Group();
      hub.position.set(sx * 0.86, 2.82, sz * 0.86);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.1), bladeMat);
      const blade2 = blade.clone();
      blade2.rotation.y = Math.PI / 2;
      hub.add(blade, blade2, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), armMat));
      this.body.add(arm, hub);
      this.rotors.push(hub);
    });
    this.antenna.visible = false;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), this.mats.glow);
    lamp.position.y = 0.6;
    this.body.add(lamp);
  }

  jump() {
    if (this.y > 0.01 || this.pose === 'sit') return false;
    this.vy = 8.5;
    this.squash = -0.25;
    return true;
  }

  // Hold something in the right hand (a book, a net...), or null to put it away.
  hold(object) {
    const hand = this.arms[1].hand;
    hand.clear();
    if (object) hand.add(object);
  }

  // speed01: 0 idle .. 1 full run. Called once per frame after physics.
  animate(dt, t, speed01, heading) {
    let d = heading - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, dt * 12);

    this.poseK += ((this.pose === 'sit' ? 1 : 0) - this.poseK) * Math.min(1, dt * 5);
    const sit = this.poseK;
    this.phase += dt * (4 + speed01 * 12);
    const swing = Math.sin(this.phase) * 0.9 * speed01 * (1 - sit);
    // Sitting: legs swing forward, arms come in to hold a book.
    this.legs[0].rotation.x = swing - sit * 1.45;
    this.legs[1].rotation.x = -swing - sit * 1.45;
    this.arms[0].rotation.x = -swing * 0.8 - sit * 0.9;
    this.arms[1].rotation.x = swing * 0.8 - sit * 0.9;
    this.arms[0].rotation.z = -0.18 - speed01 * 0.1 + sit * 0.25;
    this.arms[1].rotation.z = 0.18 + speed01 * 0.1 - sit * 0.25;

    const hover = this.flying ? 0.5 + Math.sin(t * 2.2) * 0.15 : 0;
    const bob = Math.abs(Math.sin(this.phase)) * 0.12 * speed01 + Math.sin(t * 2) * 0.03 * (1 - speed01);
    this.body.position.y = this.y + bob + hover - sit * 0.35;
    this.body.rotation.x = speed01 * 0.18 * (1 - sit);
    // Idle: the head looks around a little; stargazing tilts it up.
    this.head.rotation.z = Math.sin(t * 1.6) * 0.05 * (1 - speed01);
    this.head.rotation.y = Math.sin(t * 0.45) * 0.25 * (1 - speed01) * (1 - this.lookUp) * (1 - sit);
    this.head.rotation.x = -this.lookUp * 0.55 + sit * (1 - this.lookUp) * 0.22;
    // Springy antenna: lags behind acceleration.
    this.antennaLag += (speed01 * 0.5 - this.antennaLag) * Math.min(1, dt * 6);
    this.antenna.rotation.x = -this.antennaLag + Math.sin(t * 7) * 0.04;
    this.tip.material.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5;
    this.core.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08);
    this.rotors?.forEach((r, i) => (r.rotation.y = t * (i % 2 ? 40 : -40)));

    this.squash += (0 - this.squash) * Math.min(1, dt * 10);
    const s = 1 + this.squash;
    this.body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));

    this.blinkAt -= dt;
    const closed = this.blinkAt < 0.12;
    this.eyes.forEach((e) => (e.scale.y = closed ? 0.12 : 1));
    if (this.blinkAt < 0) this.blinkAt = 2 + Math.random() * 3;

    const air = Math.min(1, (this.y + hover) / 2);
    this.blob.scale.setScalar(1 - air * 0.5);
    this.blob.material.opacity = 0.2 * (1 - air * 0.6);
  }
}

// ---------- Outfits: each helper dresses for the part of the island it looks after ----------
const OUTFITS = {
  // Scout, the guide at the plaza: safari hat, backpack and a rolled map.
  explorer(bot, p) {
    const khaki = std(0xd8c49a);
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.06, 28), khaki);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), khaki);
    crown.scale.y = 0.8;
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.1, 24), std(p.accent));
    ribbon.position.y = 0.08;
    hat.add(brim, crown, ribbon);
    hat.position.y = 0.6;
    hat.rotation.z = -0.08;
    bot.head.add(hat);
    bot.antenna.visible = false;
    const pack = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.7, 0.36, 3, 0.12), std(0x8a6b45));
    pack.position.set(0, 1.05, -0.52);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 10), std(0xf3ead2));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 1.45, -0.55);
    bot.body.add(pack, roll);
  },
  // Bugsy, keeper of the Bug Arena: goggles and a bug net.
  exterminator(bot, p) {
    const lens = new THREE.MeshStandardMaterial({ color: 0x9fe6ff, emissive: 0x2a7fa8, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.3 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 32), std(p.dark));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.32;
    bot.head.add(band);
    [-0.3, 0.3].forEach((x) => {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16), lens);
      g.rotation.x = Math.PI / 2;
      g.position.set(x, 0.42, 0.6);
      bot.head.add(g);
    });
    const net = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.8), std(0x8a6a4a));
    pole.position.y = 0.6;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 24), std(p.accent));
    hoop.position.y = 1.65;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, 1.65, -0.3);
    net.add(pole, hoop, mesh);
    net.rotation.x = 0.3;
    bot.hold(net);
  },
  // Quizzy, the quiz master near the Frontend Garden: mortarboard and round glasses.
  scholar(bot, p) {
    const cap = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.07, 1.25), std(p.dark));
    board.rotation.y = Math.PI / 4;
    board.position.y = 0.18;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.3, 20), std(p.dark));
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45), std(0xffd166));
    tassel.position.set(0.55, -0.02, 0.2);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), std(0xffd166));
    knot.position.y = 0.23;
    cap.add(base, board, tassel, knot);
    cap.position.y = 0.66;
    bot.head.add(cap);
    bot.antenna.visible = false;
    const rim = std(0x2a2f3a, { metalness: 0.6, roughness: 0.3 });
    [-0.27, 0.27].forEach((x) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 20), rim);
      r.position.set(x, 0.0, 0.7);
      bot.head.add(r);
    });
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2), rim);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.05, 0.7);
    bot.head.add(bridge);
  },
  // Dash, the deploy racer near the Data Docks: helmet stripe, race number and a flowing scarf.
  racer(bot, p) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 1.34), std(p.accent));
    stripe.position.y = 0.64;
    bot.head.add(stripe);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0c2d5e';
    g.font = '700 70px "Space Grotesk", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('07', 64, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const num = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ map: tex }));
    num.position.set(0, 1.05, 0.397);
    bot.core.visible = false;
    bot.body.add(num);
    // Scarf: a chain of segments that streams out behind when running.
    const red = std(p.accent);
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 24), red);
    knot.rotation.x = Math.PI / 2;
    knot.position.y = 1.42;
    bot.body.add(knot);
    const scarf = [];
    let parent = bot.body;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      seg.position.set(i ? 0 : 0.2, i ? 0 : 1.4, i ? -0.24 : -0.38);
      const piece = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.26), red);
      piece.position.z = -0.12;
      seg.add(piece);
      parent.add(seg);
      scarf.push(seg);
      parent = seg;
    }
    const base = bot.animate.bind(bot);
    bot.animate = (dt, t, speed01, heading) => {
      base(dt, t, speed01, heading);
      scarf.forEach((s, i) => {
        s.rotation.x = 0.5 - speed01 * 0.4 + Math.sin(t * (6 + speed01 * 8) - i) * (0.15 + speed01 * 0.25);
        s.rotation.y = Math.sin(t * 3 - i * 0.7) * 0.2;
      });
    };
  },
  // Hiro at Hire HQ: navy suit, shirt collar, tie and a briefcase.
  suit(bot, p) {
    const shirt = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 3), std(0xffffff));
    shirt.rotation.x = Math.PI;
    shirt.position.set(0, 1.27, 0.37);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.04), std(p.accent));
    tie.position.set(0, 1.1, 0.41);
    bot.core.visible = false;
    bot.body.add(shirt, tie);
    const brief = new THREE.Group();
    const caseMesh = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.42, 0.16, 3, 0.05), std(0x5a3b26));
    caseMesh.position.y = -0.2;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI), std(0x2a1a10));
    handle.position.y = 0.02;
    brief.add(caseMesh, handle);
    bot.hold(brief);
  },
};
