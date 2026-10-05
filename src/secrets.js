import * as THREE from 'three';
import { SECRETS } from './data.js';

const byId = Object.fromEntries(SECRETS.map((s) => [s.id, s]));
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

// ctx: { scene, addCollider }
export function createSecrets({ scene, addCollider }) {
  const anim = [];
  const put = (mesh, x, y, z, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  // ---------- Spirit Grove: ancient mossy trees, glowing mushrooms, shy forest spirits ----------
  {
    const { x: cx, z: cz } = byId.spirit;
    put(new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10, 0.12, 40), mat('#4f7f45')), cx, 0.06, cz, false);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const x = cx + Math.cos(a) * 7.5;
      const z = cz + Math.sin(a) * 7.5;
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 7, 8), mat('#5b4433')), x, 3.5, z);
      put(new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), mat(i % 2 ? '#2f6b3a' : '#3d7d44')), x, 8.2, z);
      put(new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), mat('#4a8f4f')), x + 0.8, 10.2, z - 0.4);
      addCollider(x, z, 1.3);
    }
    // Glowing mushrooms: soft at day, bright at night (they are emissive, so bloom picks them up).
    const glowMat = mat('#bff7ff', { emissive: '#5fe7ff', emissiveIntensity: 1.4 });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 5;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6), mat('#f3efe4')), x, 0.17, z, false);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), glowMat), x, 0.33, z, false);
    }
    // Forest spirits: round white bodies, big wobbly heads, little black eyes.
    const white = mat('#f6f4ee', { flatShading: false, roughness: 0.6, emissive: '#bfeeff', emissiveIntensity: 0.15 });
    const black = new THREE.MeshBasicMaterial({ color: '#1b1b1f' });
    const spirits = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 10), white);
      body.position.y = 0.42;
      const head = new THREE.Group();
      head.position.y = 0.95;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), white);
      skull.scale.set(1, 1.1, 0.9);
      head.add(skull);
      [[-0.12, 0.05], [0.12, 0.02], [0, -0.14]].forEach(([ex, ey], k) => {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(k === 2 ? 0.04 : 0.055, 8, 6), black);
        dot.position.set(ex, ey, 0.3);
        head.add(dot);
      });
      g.add(body, head);
      const a = (i / 9) * Math.PI * 2;
      const r = 3 + (i % 3) * 1.4;
      g.position.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
      g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(g);
      spirits.push({ g, head, seed: Math.random() * 10, hide: 0 });
    }
    anim.push((dt, t, player, speed) => spirits.forEach((s) => {
      // They duck into the ground if you rush in, and come back up when you are calm.
      const near = Math.hypot(player.x - s.g.position.x, player.z - s.g.position.z) < 6;
      s.hide += ((near && speed > 0.55 ? 1 : 0) - s.hide) * Math.min(1, dt * 6);
      s.g.position.y = -1.3 * s.hide;
      s.g.lookAt(player.x, 0, player.z);
      // The famous head rattle: a fast wobble in short bursts.
      const burst = Math.max(0, Math.sin(t * 0.9 + s.seed * 3)) ** 8;
      s.head.rotation.z = Math.sin(t * 40 + s.seed) * 0.35 * burst;
      s.head.rotation.x = Math.sin(t * 1.3 + s.seed) * 0.08;
    }));
  }

  // ---------- Koi Pond: rippling water, swimming koi, lily pads ----------
  {
    const { x: cx, z: cz } = byId.koi;
    put(new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.9, 0.2, 40), mat('#c9bfae')), cx, 0.05, cz, false);
    const water = put(new THREE.Mesh(new THREE.CircleGeometry(6.8, 48), new THREE.MeshStandardMaterial({ color: '#4fb3c9', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false })), cx, 0.18, cz, false);
    water.rotation.x = -Math.PI / 2;
    addCollider(cx, cz, 6.2); // the pond itself: walk around it, not through it
    const ripples = [0, 1, 2].map((i) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: '#e6fbff', transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.userData = { offset: i / 3, at: new THREE.Vector2(cx + (i - 1) * 2.5, cz + (i % 2) * 2 - 1) };
      scene.add(ring);
      return ring;
    });
    const pads = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 4;
      const pad = put(new THREE.Mesh(new THREE.CircleGeometry(0.6 + Math.random() * 0.3, 14, 0.3, Math.PI * 1.8), mat('#5c9c45')), cx + Math.cos(a) * r, 0.21, cz + Math.sin(a) * r, false);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = Math.random() * 6;
      if (i % 3 === 0) put(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 6), mat('#ff9ec0')), pad.position.x, 0.36, pad.position.z, false);
      pads.push(pad);
    }
    const koi = [];
    const koiColors = [['#ff7a33', '#ffffff'], ['#ffffff', '#ff5a1f'], ['#ffb347', '#1b1b1f'], ['#ff6040', '#ffffff'], ['#f5f0e6', '#ff8a3d']];
    koiColors.forEach(([body, spot], i) => {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), mat(body, { flatShading: false }));
      torso.scale.set(0.7, 0.45, 1.6);
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(spot, { flatShading: false }));
      patch.position.set(0, 0.1, 0.1);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), mat(body));
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.6;
      g.add(torso, patch, tail);
      scene.add(g);
      koi.push({ g, tail, r: 2 + i * 0.85, speed: (0.35 + i * 0.07) * (i % 2 ? 1 : -1), a: i * 1.3 });
    });
    anim.push((dt, t) => {
      koi.forEach((k) => {
        k.a += k.speed * dt;
        const r = k.r + Math.sin(t * 0.4 + k.a) * 0.4;
        k.g.position.set(cx + Math.cos(k.a) * r, 0.1, cz + Math.sin(k.a) * r);
        // Face along the circle, tail wagging faster as it swims.
        k.g.rotation.y = -k.a + (k.speed > 0 ? Math.PI : 0);
        k.tail.rotation.y = Math.sin(t * 9 + k.a) * 0.5;
      });
      ripples.forEach((rg) => {
        const p = (t * 0.35 + rg.userData.offset) % 1;
        rg.position.set(rg.userData.at.x, 0.2, rg.userData.at.y);
        rg.scale.setScalar(0.3 + p * 3);
        rg.material.opacity = (1 - p) * 0.6;
      });
      pads.forEach((pad, i) => (pad.position.y = 0.21 + Math.sin(t * 1.2 + i) * 0.01));
    });
  }

  // ---------- Windmill Hill: turning windmill, sunflower field, butterflies ----------
  {
    const { x: cx, z: cz } = byId.windmill;
    put(new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.5, 0.3, 32), mat('#9ccf6e')), cx, 0.08, cz, false); // low, so Byte doesn't sink in
    put(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 7, 8), mat('#f2e6cf')), cx, 4, cz);
    put(new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.2, 8), mat('#b5523b')), cx, 8.6, cz);
    addCollider(cx, cz, 2.3);
    const hub = new THREE.Group();
    hub.position.set(cx + 1.4, 6.8, cz + 1.4);
    hub.rotation.y = Math.PI / 4; // blades face the camera
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.06), mat('#fff8ea'));
      sail.position.y = 2.1;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4, 0.12), mat('#6d4b35'));
      spar.position.y = 2;
      arm.add(sail, spar);
      hub.add(arm);
    }
    scene.add(hub);
    anim.push((dt, t, player, speed, wind) => (hub.rotation.z -= dt * (0.6 + wind * 0.4)));

    const flowers = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 4.2;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const g = new THREE.Group();
      g.position.set(x, 0.15, z);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 5), mat('#4c8a3a'));
      stem.position.y = 0.8;
      const head = new THREE.Group();
      head.position.y = 1.65;
      const petalsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), mat('#ffcf2e'));
      const center = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), mat('#6b3f1d'));
      center.position.y = 0.03;
      head.add(petalsMesh, center);
      head.rotation.x = Math.PI / 2.4;
      head.rotation.z = Math.PI / 4;
      g.add(stem, head);
      scene.add(g);
      flowers.push({ g, seed: Math.random() * 6 });
    }
    anim.push((dt, t, player, speed, wind) => flowers.forEach((f) => (f.g.rotation.z = Math.sin(t * 1.4 + f.seed + f.g.position.x * 0.2) * 0.08 * (1 + wind))));

    const wingGeo = new THREE.CircleGeometry(0.28, 10);
    const butterflies = ['#ff8fb1', '#9fd8ff', '#ffe066', '#c3a6ff', '#ffffff'].map((c, i) => {
      const g = new THREE.Group();
      const wm = new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide });
      const l = new THREE.Mesh(wingGeo, wm);
      const r = new THREE.Mesh(wingGeo, wm);
      l.position.x = -0.24;
      r.position.x = 0.24;
      const lp = new THREE.Group();
      const rp = new THREE.Group();
      lp.add(l);
      rp.add(r);
      g.add(lp, rp);
      scene.add(g);
      return { g, lp, rp, seed: i * 1.7 };
    });
    anim.push((dt, t) => butterflies.forEach((b) => {
      // Lissajous loops over the field with a bit of up-and-down drift.
      const s = b.seed;
      b.g.position.set(cx + Math.sin(t * 0.5 + s) * 5, 2.2 + Math.sin(t * 1.7 + s) * 0.7, cz + Math.sin(t * 0.37 + s * 2) * 5);
      b.g.rotation.y = Math.atan2(Math.cos(t * 0.5 + s) * 0.5, Math.cos(t * 0.37 + s * 2) * 0.37);
      const flap = Math.sin(t * 18 + s) * 1.1;
      b.lp.rotation.y = flap;
      b.rp.rotation.y = -flap;
    }));
  }

  // ---------- Wind Shrine and the floating sky island ----------
  {
    const { x: cx, z: cz } = byId.shrine;
    put(new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.8, 0.18, 32), mat('#d9cfbf')), cx, 0.06, cz, false);
    const red = mat('#d6342c');
    // Torii gate facing the camera.
    const gate = new THREE.Group();
    gate.position.set(cx + 2.5, 0, cz + 2.5);
    gate.rotation.y = Math.PI / 4;
    [-2, 2].forEach((x) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 5, 10), red);
      post.position.set(x, 2.5, 0);
      post.castShadow = true;
      gate.add(post);
    });
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(6, 0.45, 0.6), mat('#1b1b1f'));
    kasagi.position.y = 5.2;
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.4), red);
    nuki.position.y = 4.2;
    gate.add(kasagi, nuki);
    scene.add(gate);
    [-2, 2].forEach((x) => {
      const v = new THREE.Vector3(x, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
      addCollider(gate.position.x + v.x, gate.position.z + v.z, 0.5);
    });
    // Stone lanterns.
    [[-3, -1], [-1, -3]].forEach(([dx, dz]) => {
      const lx = cx + dx;
      const lz = cz + dz;
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.6, 6), mat('#a9a399')), lx, 0.8, lz);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat('#fff0c2', { emissive: '#ffcf6a', emissiveIntensity: 1 })), lx, 1.9, lz);
      put(new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.6, 4), mat('#8f8a80')), lx, 2.5, lz);
      addCollider(lx, lz, 0.6);
    });
    // Wind chimes hanging from the gate beam.
    const chimes = [];
    for (let i = 0; i < 5; i++) {
      const pivot = new THREE.Group();
      const v = new THREE.Vector3(-1 + i * 0.5, 4.05, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
      pivot.position.set(gate.position.x + v.x, v.y, gate.position.z + v.z);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6 + (i % 3) * 0.2, 6), mat('#e8d9a8', { metalness: 0.6, roughness: 0.3 }));
      rod.position.y = -0.4;
      pivot.add(rod);
      scene.add(pivot);
      chimes.push(pivot);
    }
    anim.push((dt, t, player, speed, wind) => chimes.forEach((c, i) => {
      c.rotation.z = Math.sin(t * 2.2 + i * 1.3) * 0.25 * (0.5 + wind);
      c.rotation.x = Math.cos(t * 1.7 + i) * 0.15 * (0.5 + wind);
    }));

    // Floating island out over the sea, with a waterfall pouring off its edge.
    const sky = new THREE.Group();
    sky.position.set(-66, 28, -70);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(9, 12, 9), mat('#8b7a66'));
    rock.rotation.x = Math.PI;
    rock.position.y = -6;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1.5, 9), mat('#86c85e'));
    sky.add(rock, top);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tree = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.6, 7), mat('#3f8a45'));
      tree.position.set(Math.cos(a) * 5, 2.4, Math.sin(a) * 5);
      sky.add(tree);
    }
    const ruin = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4, 8), mat('#e8e0d0'));
    ruin.position.set(0, 2.6, 0);
    sky.add(ruin);
    const fallMat = new THREE.MeshBasicMaterial({ color: '#e9f8ff', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 30, 1, 20), fallMat);
    fall.position.set(8.6, -14, 3);
    fall.rotation.y = Math.PI / 4;
    sky.add(fall);
    scene.add(sky);
    const drops = Array.from({ length: 40 }, () => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), fallMat);
      d.userData = { y: Math.random(), x: (Math.random() - 0.5) * 2 };
      sky.add(d);
      return d;
    });
    anim.push((dt, t) => {
      sky.position.y = 28 + Math.sin(t * 0.4) * 1.2;
      sky.rotation.y = Math.sin(t * 0.1) * 0.08;
      drops.forEach((d) => {
        d.userData.y = (d.userData.y + dt * 0.5) % 1;
        d.position.set(8.6 + d.userData.x * 0.5, -d.userData.y * 30 + 1, 3 + d.userData.x * 0.5);
      });
    });
  }

  return {
    // The secret place the player is standing in (or null).
    at(player) {
      return SECRETS.find((s) => Math.hypot(player.x - s.x, player.z - s.z) < s.r) ?? null;
    },
    update(dt, t, player, speed01, wind) {
      anim.forEach((fn) => fn(dt, t, player, speed01, wind));
    },
  };
}
