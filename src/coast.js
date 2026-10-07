import * as THREE from 'three';
import { paint, rng, std, label, makeGate, rock } from './realmkit.js';
import { NOISE } from './sky.js';

// Coral Coast: a sandy island in a warm sea with palm trees, a lighthouse, a pier, crabs and,
// on lucky visits, a hawksbill turtle crawling down the beach.

const SPOTS = [
  { id: 'lighthouse', x: -40, z: -34, r: 6, kicker: 'Coral Coast', title: 'The lighthouse',
    text: 'Before GPS, lighthouses told sailors exactly where they were. Each one flashes in its own pattern, called its "character", so ships can tell them apart in the dark.' },
  { id: 'reef', x: 44, z: 8, r: 6, kicker: 'Coral Coast // Under the water', title: 'Coral reefs',
    text: 'Coral reefs cover less than one percent of the ocean floor, yet they are home to roughly a quarter of all marine species. When the sea gets too warm, corals expel the algae that feed and colour them and turn white: this is called coral bleaching.' },
];
export const TURTLE = {
  name: 'Hawksbill Sea Turtle', latin: 'Eretmochelys imbricata', status: 'Critically Endangered',
  text: 'Named for its narrow, pointed beak, which it uses to pull sponges out of cracks in coral reefs, helping keep the reefs healthy. For centuries its beautiful shell was hunted to make "tortoiseshell" combs and jewellery; international trade in it has been banned since 1977.',
};

function palm(rand, height) {
  const g = new THREE.Group();
  const trunkMat = std('#8a6a48', { roughness: 0.95 });
  const lean = 0.25 + rand() * 0.3;
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    pts.push(new THREE.Vector3(Math.sin(k * 1.4) * lean * height * 0.5, k * height, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.22, 8), trunkMat);
  trunk.castShadow = true;
  g.add(trunk);
  // Ringed trunk texture as little bands.
  for (let i = 1; i < 8; i++) {
    const p = curve.getPoint(i / 8);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 5, 12), std('#6f5236'));
    ring.position.copy(p);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const top = curve.getPoint(1);
  const frondMat = std('#3f8a3a', { side: THREE.DoubleSide, roughness: 0.8 });
  // Each frond: a long tapered leaf that arches out and droops.
  const frond = new THREE.PlaneGeometry(0.7, 3.2, 1, 8);
  const fp = frond.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i) + 1.6; // 0..3.2 along the leaf
    const w = 1 - y / 3.4;
    fp.setX(i, fp.getX(i) * w);
    fp.setZ(i, -(y * y) * 0.16);
    fp.setY(i, y);
  }
  frond.computeVertexNormals();
  const crown = new THREE.Group();
  crown.position.copy(top);
  for (let k = 0; k < 9; k++) {
    const f = new THREE.Mesh(frond, frondMat);
    f.rotation.set(-1.1 + rand() * 0.3, (k / 9) * Math.PI * 2, 0, 'YXZ');
    f.castShadow = true;
    crown.add(f);
  }
  for (let k = 0; k < 3; k++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), std('#5b4128'));
    nut.position.set(Math.cos(k * 2.1) * 0.22, -0.2, Math.sin(k * 2.1) * 0.22);
    crown.add(nut);
  }
  g.add(crown);
  return { group: g, crown };
}

function turtle() {
  const g = new THREE.Group();
  const shellTex = paint(256, 256, (c, w, h) => {
    c.fillStyle = '#6b3c1c';
    c.fillRect(0, 0, w, h);
    const r = rng(12);
    // Tortoiseshell: amber and dark brown flames on overlapping plates.
    for (let i = 0; i < 160; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(214,150,60,0.55)' : 'rgba(40,20,10,0.5)';
      c.beginPath();
      c.ellipse(r() * w, r() * h, 4 + r() * 14, 2 + r() * 6, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(30,15,5,0.7)';
    c.lineWidth = 3;
    for (let x = 0; x < w; x += 64) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 20, h);
      c.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y + 10);
      c.stroke();
    }
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', { map: shellTex, roughness: 0.45 }));
  shell.scale.set(0.62, 0.32, 0.85);
  shell.position.y = 0.18;
  shell.castShadow = true;
  const plastron = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(Math.PI / 2), std('#e2cfa0'));
  plastron.scale.set(0.6, 1, 0.82);
  plastron.position.y = 0.18;
  const skin = std('#8a7a5a', { roughness: 0.8 });
  const head = new THREE.Group();
  head.position.set(0, 0.22, 0.9);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), skin);
  skull.scale.set(1, 0.85, 1.3);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 8), std('#4a3c2a'));
  beak.rotation.x = Math.PI / 2 + 0.3; // the hawk-like hooked beak
  beak.position.set(0, -0.03, 0.24);
  head.add(skull, beak);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std('#151008', { roughness: 0.2 }));
    eye.position.set(s * 0.1, 0.04, 0.12);
    head.add(eye);
  });
  const flippers = [[-1, 0.45, 1], [1, 0.45, 1], [-1, -0.55, 0.6], [1, -0.55, 0.6]].map(([s, z, size]) => {
    const p = new THREE.Group();
    p.position.set(s * 0.5, 0.12, z);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), skin);
    f.scale.set(0.75 * size, 0.08, 0.32 * size);
    f.position.x = s * 0.32 * size;
    f.rotation.y = s * -0.4;
    p.add(f);
    g.add(p);
    return { p, s };
  });
  g.add(shell, plastron, head);
  return { group: g, flippers, head };
}

function crab() {
  const g = new THREE.Group();
  const red = std('#d8532f', { roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), red);
  body.scale.set(1.3, 0.45, 1);
  body.position.y = 0.2;
  g.add(body);
  const legs = [];
  [-1, 1].forEach((s) => {
    for (let k = 0; k < 3; k++) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.3, 3, 4), red);
      leg.position.set(s * 0.38, 0.12, -0.15 + k * 0.15);
      leg.rotation.z = s * 1.0;
      g.add(leg);
      legs.push(leg);
    }
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), red);
    claw.scale.set(1, 0.7, 1.3);
    claw.position.set(s * 0.28, 0.22, 0.32);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 5), std('#2a1a12'));
    eye.position.set(s * 0.09, 0.33, 0.18);
    g.add(claw, eye);
  });
  return { group: g, legs };
}

// A bottlenose dolphin: a smooth tapered body (lathe), counter-shaded grey over a pale belly,
// curved dorsal fin, flippers and flukes.
function dolphin() {
  const g = new THREE.Group();
  const prof = [[0, -1.5], [0.12, -1.35], [0.3, -0.9], [0.42, -0.2], [0.4, 0.4], [0.3, 0.95], [0.2, 1.25], [0.08, 1.55], [0.05, 1.8], [0, 1.85]].map(([r, y]) => new THREE.Vector2(r, y));
  const skin = new THREE.MeshStandardMaterial({ color: '#7d8c99', roughness: 0.35, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), skin);
  body.rotation.x = Math.PI / 2; // nose toward +z
  body.scale.set(1, 1, 0.85);
  const belly = new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(v.x * 0.92, v.y)), 24, Math.PI * 0.6, Math.PI * 0.8), std('#d9dfe4', { roughness: 0.4 }));
  belly.rotation.x = Math.PI / 2;
  belly.position.y = -0.03;
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.quadraticCurveTo(-0.1, 0.35, -0.35, 0.5);
  fin.quadraticCurveTo(-0.15, 0.2, -0.45, 0);
  const dorsal = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: false }), skin);
  dorsal.rotation.y = Math.PI / 2;
  dorsal.position.set(-0.025, 0.36, 0.1);
  const fluke = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 6), skin);
  fluke.scale.set(1.3, 0.08, 0.45);
  fluke.position.set(0, 0, -1.55);
  g.add(body, belly, dorsal, fluke);
  [-1, 1].forEach((s) => {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), skin);
    fl.scale.set(1.4, 0.15, 0.6);
    fl.position.set(s * 0.42, -0.15, 0.55);
    fl.rotation.z = s * 0.5;
    g.add(fl);
  });
  return g;
}

export function buildCoast({ scene, origin, addCollider, getAudio, soundOn }) {
  const R = 62;
  const root = new THREE.Group();
  root.position.set(origin.x, 0, origin.z);
  scene.add(root);
  const col = (x, z, r) => addCollider(origin.x + x, origin.z + z, r);
  const rand = rng(23);
  const put = (mesh, x, y, z, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // ---------- sand, with a grassy heart ----------
  const sandTex = paint(1024, 1024, (g, w, h) => {
    g.fillStyle = '#ecd9ac';
    g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(200,175,120,0.3)' : 'rgba(255,245,220,0.35)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // A grassy middle.
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.3);
    grad.addColorStop(0, 'rgba(120,160,80,0.9)');
    grad.addColorStop(0.75, 'rgba(140,170,90,0.6)');
    grad.addColorStop(1, 'rgba(140,170,90,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Wet sand darker near the waterline.
    const wet = g.createRadialGradient(w / 2, h / 2, w * 0.43, w / 2, h / 2, w * 0.5);
    wet.addColorStop(0, 'rgba(150,120,80,0)');
    wet.addColorStop(1, 'rgba(150,120,80,0.45)');
    g.fillStyle = wet;
    g.fillRect(0, 0, w, h);
  });
  const isle = new THREE.Mesh(new THREE.CylinderGeometry(R + 2, R + 9, 2.4, 96), [std('#d9c08f'), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }), std('#d9c08f')]);
  put(isle, 0, -1.2, 0, false);

  // ---------- the sea: waves, turquoise shallows, deep blue offshore, foam at the shore ----------
  const seaU = { uTime: { value: 0 }, uR: { value: R + 2 }, uFog: { value: scene.fog.color }, uFar: { value: 300 } };
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: seaU,
      vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime, uR, uFar; uniform vec3 uFog; varying vec3 vW; ${NOISE}
        void main() {
          vec2 local = vW.xz - vec2(${origin.x.toFixed(1)}, ${origin.z.toFixed(1)});
          float d = length(local) - uR;
          float waves = sFbm(vW.xz * 0.08 + vec2(uTime * 0.05, uTime * 0.03)) * 0.6 + sFbm(vW.xz * 0.3 - uTime * 0.12) * 0.4;
          vec3 shallow = vec3(0.25, 0.82, 0.8);
          vec3 deep = vec3(0.04, 0.3, 0.55);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 40.0, d));
          col += (waves - 0.5) * 0.12;
          col += vec3(1.0) * smoothstep(0.62, 0.8, waves) * 0.18; // glints
          // Foam lines rolling in to the beach.
          float roll = sin(d * 0.9 - uTime * 1.6);
          float foam = smoothstep(0.75, 1.0, roll) * (1.0 - smoothstep(0.0, 9.0, d)) + (1.0 - smoothstep(0.0, 1.6, d));
          col = mix(col, vec3(0.97, 0.98, 1.0), clamp(foam * (0.6 + waves * 0.4), 0.0, 0.9));
          float dist = length(vW.xz - cameraPosition.xz);
          col = mix(col, uFog, smoothstep(uFar * 0.25, uFar, dist));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
  sea.position.y = -0.35;
  root.add(sea);

  // ---------- swash: the end of each wave runs up the sand, over Byte's feet, and drains back ----------
  // surge() is shared by the shader and the CPU so the splash sound fires exactly when the water
  // visibly reaches the player.
  const SH = R + 2; // where the sand meets the sea
  const REACH = 10;
  const surge = (a, t) => {
    const v = 0.5 + 0.5 * Math.sin(t * 0.55 + Math.sin(a * 3) * 0.6 + Math.sin(a * 7 + 1) * 0.3);
    return v * v;
  };
  const washU = { uTime: seaU.uTime, uDim: { value: 1 } };
  const wash = new THREE.Mesh(
    new THREE.RingGeometry(SH - REACH - 1, SH + 2.5, 256, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: washU,
      transparent: true,
      depthWrite: false,
      vertexShader: 'varying vec2 vL; void main() { vL = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime, uDim; varying vec2 vL; ${NOISE}
        float surge(float a, float t) { float v = 0.5 + 0.5 * sin(t * 0.55 + sin(a * 3.0) * 0.6 + sin(a * 7.0 + 1.0) * 0.3); return v * v; }
        void main() {
          float a = atan(vL.y, vL.x);
          float r = length(vL);
          float edge = (sFbm(vec2(a * 40.0, uTime * 0.4)) - 0.5) * 0.8; // ragged front
          float front = ${SH.toFixed(1)} - ${REACH.toFixed(1)} * surge(a, uTime) + edge;
          float wetLine = ${SH.toFixed(1)} - ${REACH.toFixed(1)} * max(surge(a, uTime), surge(a, uTime - 1.8)) + edge;
          if (r < wetLine) discard;
          vec4 col;
          if (r < front) {
            // Sand the wave just left: dark and glossy for a moment.
            col = vec4(0.42, 0.34, 0.22, 0.32 * smoothstep(wetLine, wetLine + 1.0, r));
          } else {
            float depth = smoothstep(0.0, 7.0, r - front);
            vec3 water = mix(vec3(0.62, 0.9, 0.86), vec3(0.2, 0.7, 0.75), depth);
            float bubbles = smoothstep(0.55, 0.8, sFbm(vL * 0.7 + uTime * 0.25)) * (1.0 - depth);
            float lip = 1.0 - smoothstep(0.0, 0.9, r - front);
            float foam = clamp(max(lip, bubbles * 0.8), 0.0, 1.0);
            col = vec4(mix(water, vec3(0.97, 0.98, 1.0), foam), max(mix(0.45, 0.85, depth), foam * 0.95));
          }
          gl_FragColor = vec4(col.rgb * uDim, col.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
  wash.position.y = 0.035;
  wash.renderOrder = 1;
  root.add(wash);
  // A ring of foam that spreads out around Byte's feet when the water arrives.
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
  ripple.position.y = 0.06;
  root.add(ripple);
  let rippleT = 9;
  let wasWet = false;

  // ---------- palms ----------
  const palms = [];
  for (let k = 0; k < 400 && palms.length < 20; k++) {
    const a = rand() * Math.PI * 2;
    const d = 12 + rand() * 40;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.hypot(x + 40, z + 34) < 8 || Math.hypot(x - 44, z - 8) < 10 || (Math.abs(x) < 5 && z > 40) || Math.hypot(x - 10, z + 30) < 8 || Math.hypot(x - 30, z + 20) < 9 || Math.hypot(x + 14, z - 46) < 5 || Math.hypot(x + 30, z - 4) < 8 || Math.hypot(x - 36, z - 36) < 5) continue;
    if (palms.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) continue;
    const p = palm(rand, 7 + rand() * 4);
    p.group.position.set(x, 0, z);
    p.group.rotation.y = rand() * Math.PI * 2;
    root.add(p.group);
    palms.push({ x, z, ...p, seed: rand() * 6 });
    col(x, z, 0.5);
  }

  // ---------- lighthouse ----------
  const LX = -42;
  const LZ = -36;
  {
    const white = std('#f4f1ea');
    const red = std('#c8342a');
    for (let k = 0; k < 6; k++) {
      put(new THREE.Mesh(new THREE.CylinderGeometry(2.2 - (k + 1) * 0.18, 2.2 - k * 0.18, 2.6, 24), k % 2 ? red : white), LX, 1.3 + k * 2.6, LZ);
    }
    put(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24), std('#2b2f36')), LX, 15.8, LZ);
    put(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 16), new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffd26a', emissiveIntensity: 1.2, transparent: true, opacity: 0.85 })), LX, 16.9, LZ, false);
    put(new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.4, 16), red), LX, 18.5, LZ);
    col(LX, LZ, 2.4);
  }
  const beamPivot = new THREE.Group();
  beamPivot.position.set(LX, 16.9, LZ);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 40, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.geometry.translate(0, -20, 0);
  beam.rotation.z = Math.PI / 2;
  beamPivot.add(beam);
  root.add(beamPivot);

  // ---------- pier and a boat ----------
  const wood = std('#9a7650', { roughness: 0.9 });
  const pierAngle = Math.atan2(8, 44);
  const pier = new THREE.Group();
  pier.position.set(Math.sin(pierAngle) * (R - 2), 0, Math.cos(pierAngle) * (R - 2));
  pier.rotation.y = pierAngle;
  root.add(pier);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 22), wood);
  deck.position.set(0, 0.2, 11);
  deck.castShadow = true;
  pier.add(deck);
  for (let z = 1; z < 22; z += 3) [-1.4, 1.4].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 6), wood);
    post.position.set(x, -0.9, z);
    pier.add(post);
  });
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#2f6fe4'));
  hull.scale.set(0.8, 0.6, 2);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 6, 24), std('#f4f1ea'));
  rim.scale.set(0.8, 2, 1);
  rim.rotation.x = Math.PI / 2;
  boat.add(hull, rim);
  boat.position.set(2.8, -0.1, 18);
  pier.add(boat);

  // ---------- beach life: huts, umbrellas, shells and starfish ----------
  [[18, 30], [26, 24]].forEach(([x, z], i) => {
    put(new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3.4), std(i ? '#f2e2c4' : '#e7d3ae')), x, 1.3, z);
    const roof = put(new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.2, 4), std('#b9925a', { flatShading: true })), x, 3.7, z);
    roof.rotation.y = Math.PI / 4;
    col(x, z, 2.6);
  });
  const stripes = ['#e8402c', '#2f6fe4', '#ffc21a'];
  [[-12, 36], [8, 44], [-26, 26]].forEach(([x, z], i) => {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), std('#f4f1ea')), x, 1.3, z);
    put(new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 12, 1, true), std(stripes[i], { side: THREE.DoubleSide })), x, 2.7, z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 1.9), std('#f4f1ea')), x + 1.2, 0.35, z + 0.4);
    col(x, z, 0.4);
  });
  const shellMat = std('#f3e3d6');
  const starMat = std('#e8823a');
  for (let i = 0; i < 28; i++) {
    const a = rand() * Math.PI * 2;
    const d = R - 8 + rand() * 6;
    if (i % 3) {
      const s = put(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 8), shellMat), Math.cos(a) * d, 0.08, Math.sin(a) * d, false);
      s.rotation.set(Math.PI / 2, rand() * 6, 0);
    } else {
      const star = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.25, 3, 6), starMat);
        arm.rotation.set(Math.PI / 2, 0, (k / 5) * Math.PI * 2);
        arm.position.set(Math.cos((k / 5) * Math.PI * 2 + Math.PI / 2) * 0.15, 0, Math.sin((k / 5) * Math.PI * 2 + Math.PI / 2) * 0.15);
        star.add(arm);
      }
      star.position.set(Math.cos(a) * d, 0.06, Math.sin(a) * d);
      root.add(star);
    }
  }

  // ---------- rocks at the waterline, a beach bar, games on the sand ----------
  [[-0.4, 4, 2.6], [-0.48, 6, 1.6], [2.1, 3, 3.0], [2.2, 6, 1.8], [3.6, 2, 2.2], [4.4, 5, 2.8], [4.5, 2, 1.5]].forEach(([a, d, sz], i) => {
    const r = rock(sz, 90 + i, { color: '#5f5a55', dark: '#3a3633', flat: 0.7 });
    r.position.set(Math.cos(a) * (R + d), -0.6, Math.sin(a) * (R + d));
    r.rotation.y = i * 1.7;
    root.add(r);
  });
  const lightMats = [];
  {
    // A thatched beach bar with a counter, stools and festoon lights that glow at night.
    const BX = 30;
    const BZ = -20;
    const bar = new THREE.Group();
    bar.position.set(BX, 0, BZ);
    bar.rotation.y = Math.atan2(-BX, -BZ);
    root.add(bar);
    const timber = std('#8a6440', { roughness: 0.9 });
    [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]].forEach(([x, z]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 3.4, 8), timber);
      post.position.set(x, 1.7, z);
      post.castShadow = true;
      bar.add(post);
    });
    const thatch = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.8, 24, 3), std('#c9a46a', { roughness: 1 }));
    thatch.position.y = 4.1;
    thatch.scale.z = 0.85;
    thatch.castShadow = true;
    const fringe = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.75, 0.45, 24, 1, true), std('#b48e57', { roughness: 1, side: THREE.DoubleSide }));
    fringe.position.y = 3.1;
    fringe.scale.z = 0.85;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.15, 0.8), timber);
    counter.position.set(0, 0.58, 1.3);
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.1, 1.0), std('#f4f1ea', { roughness: 0.4 }));
    top.position.set(0, 1.2, 1.3);
    bar.add(thatch, fringe, counter, top);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#bfe9ff', roughness: 0.05, transmission: 0.8, thickness: 0.1 });
    [-1.6, -0.6, 0.5, 1.5].forEach((x, i) => {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.08, 12), std('#2f6fe4'));
      stool.position.set(x, 0.85, 2.3);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.85, 6), std('#d0d4da', { metalness: 0.7, roughness: 0.3 }));
      leg.position.set(x, 0.42, 2.3);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.22, 10), glass);
      cup.position.set(x + 0.2, 1.36, 1.2);
      bar.add(stool, leg, cup);
      if (i % 2) {
        const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), std('#6b4a2e'));
        coconut.position.set(x - 0.25, 1.38, 1.4);
        bar.add(coconut);
      }
    });
    // Festoon lights draped around the eaves.
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const m = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: ['#ffcf6a', '#ff8a5c', '#9fe0ff'][k % 3], emissiveIntensity: 0.3 });
      lightMats.push(m);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), m);
      bulb.position.set(Math.cos(a) * 4.5, 2.75 - Math.abs(Math.sin(a * 4)) * 0.15, Math.sin(a) * 3.8);
      bar.add(bulb);
    }
    col(BX, BZ, 3.4);
    const sign = label('Coral Bar', '#1f8aa8', 5);
    sign.position.set(BX, 6.2, BZ);
    root.add(sign);
  }
  {
    // A sandcastle with towers, a keep, a flag and a moat.
    const SX = -14;
    const SZ = 46;
    const sand = std('#d9bd84', { roughness: 1 });
    put(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.6, 20), sand), SX, 0.3, SZ);
    [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([x, z]) => {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 12), sand), SX + x, 0.85, SZ + z);
      put(new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.45, 12), sand), SX + x, 1.6, SZ + z);
    });
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.6, 14), sand), SX, 1.4, SZ);
    put(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), std('#e8402c', { side: THREE.DoubleSide })), SX + 0.2, 2.7, SZ, false);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), std('#f4f1ea')), SX, 2.5, SZ, false);
    put(new THREE.Mesh(new THREE.RingGeometry(1.8, 2.3, 32).rotateX(-Math.PI / 2), std('#6fb7c6', { roughness: 0.1 })), SX, 0.02, SZ, false);
    const bucket = put(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.4, 14, 1, true), std('#ffc21a', { side: THREE.DoubleSide })), SX + 2.6, 0.2, SZ + 0.6);
    bucket.rotation.z = 1.3;
    col(SX, SZ, 2.2);
  }
  {
    // Beach volleyball: two posts, a net and a ball in the sand.
    const VX = -30;
    const VZ = 4;
    const post = std('#f4f1ea');
    [-4, 4].forEach((dz) => {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), post), VX, 1.3, VZ + dz);
      col(VX, VZ + dz, 0.3);
    });
    const netTex = paint(256, 64, (g, w, h) => {
      g.strokeStyle = 'rgba(30,30,30,0.9)';
      g.lineWidth = 2;
      for (let x = 0; x <= w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, w, 6);
    });
    const net = put(new THREE.Mesh(new THREE.PlaneGeometry(8, 1), new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })), VX, 2.0, VZ, false);
    net.rotation.y = Math.PI / 2;
    const ballTex = paint(128, 64, (g, w, h) => {
      ['#ffd21a', '#2f6fe4', '#f4f1ea'].forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(0, (i * h) / 3, w, h / 3);
      });
    });
    put(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.6 })), VX + 2.5, 0.3, VZ + 1.5);
  }
  {
    // A kayak pulled up on the sand, and bleached driftwood.
    const kayak = put(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), std('#e8402c', { roughness: 0.4 })), 36, 0.22, 36);
    kayak.scale.set(0.42, 0.22, 2.2);
    kayak.rotation.y = 0.8;
    const paddle = put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), std('#2b2f36')), 37.2, 0.1, 35.6);
    paddle.rotation.set(Math.PI / 2, 0, 0.6);
    col(36, 36, 1.2);
    const drift = std('#b8aa94', { roughness: 1 });
    [[-36, -30, 0.3], [-20, -52, 1.2], [44, 4, 2.1]].forEach(([x, z, a], i) => {
      const log = put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.6 + i * 0.6, 8), drift), x, 0.16, z);
      log.rotation.set(0, a, Math.PI / 2);
    });
  }
  // Offshore: a sailboat on the horizon and a pod of dolphins that leap now and then.
  const sail = new THREE.Group();
  {
    const hullS = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#f4f1ea'));
    hullS.scale.set(1.2, 0.8, 4);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 6), std('#c9ccd1'));
    mast.position.y = 4.5;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.8);
    shape.lineTo(0, 9);
    shape.lineTo(3.4, 0.8);
    const main = new THREE.Mesh(new THREE.ShapeGeometry(shape), std('#ffffff', { side: THREE.DoubleSide }));
    main.rotation.y = Math.PI / 2;
    sail.add(hullS, mast, main);
    root.add(sail);
  }
  const pod = [0, 1, 2].map(() => {
    const d = dolphin();
    root.add(d);
    return d;
  });

  // ---------- crabs scuttling sideways ----------
  const crabs = Array.from({ length: 7 }, (_, i) => {
    const c = crab();
    const a = (i / 7) * Math.PI * 2 + 0.3;
    c.home = new THREE.Vector3(Math.cos(a) * (R - 6), 0, Math.sin(a) * (R - 6));
    c.phase = i * 1.9;
    c.group.rotation.y = -a;
    c.group.scale.setScalar(1.3);
    root.add(c.group);
    return c;
  });

  // ---------- the hawksbill turtle (rare) ----------
  const tt = turtle();
  tt.group.scale.setScalar(1.4);
  root.add(tt.group);
  const turtleA = -0.9;
  let turtleK = 0;

  const gate = makeGate(root, 0, 52, Math.PI, 'Sky Gate');
  const nameSign = label('Coral Coast', '#1f8aa8');
  nameSign.position.set(0, 12, 16);
  root.add(nameSign);

  // Waves breaking: filtered noise that swells and fades.
  let surf = null;
  const startSurf = () => {
    if (surf || !soundOn()) return;
    const ac = getAudio();
    const buf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) d[i] = last = last * 0.85 + (Math.random() * 2 - 1) * 0.15;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ac.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(ac.destination);
    src.start();
    surf = { g, ac };
  };

  // Water rushing over the feet: a short burst of bright, fizzy noise.
  const splash = () => {
    if (!soundOn()) return;
    const ac = getAudio();
    const n = Math.floor(ac.sampleRate * 0.9);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      d[i] = (Math.random() * 2 - 1) * Math.min(1, k * 25) * Math.pow(1 - k, 2.2) * (0.7 + 0.3 * Math.sin(k * 90));
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.value = 0.32;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start();
  };

  const world = (s) => ({ ...s, x: origin.x + s.x, z: origin.z + s.z });
  return {
    id: 'coast',
    group: root,
    bounds: { x: origin.x, z: origin.z, r: R + 0.5 }, // right down to the waterline
    spawn: { x: origin.x, z: origin.z + 46 },
    movers: [tt.group, ...crabs.map((c) => c.group), ...pod, sail, boat, beamPivot, ripple, ...palms.map((p) => p.crown)],
    gate: { x: origin.x + gate.spot.x, z: origin.z + gate.spot.z },
    env: { cloudSea: false, ocean: true, fog: 1.6, snow: 0 },
    spots: SPOTS.map(world),
    animal: { def: TURTLE, get x() { return origin.x + tt.group.position.x; }, get z() { return origin.z + tt.group.position.z; } },
    onEnter() {
      tt.group.visible = Math.random() < 0.55;
      turtleK = 0;
    },
    animalVisible: () => tt.group.visible,
    // update() stops running once we travel away, so silence the surf here.
    onLeave() {
      if (surf) surf.g.gain.setTargetAtTime(0, surf.ac.currentTime, 0.4);
      wasWet = false;
    },
    map: [
      { x: 0, z: 0, r: 20, color: 'rgba(120,160,80,0.7)' },
      { x: LX, z: LZ, r: 3, color: '#c8342a' },
      { x: gate.spot.x, z: gate.spot.z, r: 2.5, color: '#2f6fe4' },
    ].map(world),
    ground: '#ecd9ac',
    sea: '#2aa9c2',
    update(dt, t, player, night, active) {
      seaU.uTime.value = t;
      seaU.uFar.value = scene.fog.far * 2;
      palms.forEach((p) => {
        p.crown.rotation.z = Math.sin(t * 0.9 + p.seed) * 0.05;
        p.crown.rotation.x = Math.cos(t * 0.7 + p.seed) * 0.04;
      });
      beamPivot.rotation.y = t * 0.8;
      beam.visible = night;
      boat.position.y = -0.1 + Math.sin(t * 1.2) * 0.12;
      lightMats.forEach((m, i) => (m.emissiveIntensity = night ? 2.2 + Math.sin(t * 2 + i) * 0.3 : 0.3));
      const sa = t * 0.012;
      sail.position.set(Math.cos(sa) * 170, -0.2 + Math.sin(t * 0.8) * 0.15, Math.sin(sa) * 170);
      sail.rotation.y = -sa;
      sail.rotation.z = Math.sin(t * 0.6) * 0.05;
      // The pod circles the island; every few seconds each dolphin arcs out of the water.
      pod.forEach((d, i) => {
        const base = t * 0.03 + i * 0.05 + 1.2;
        const leap = ((t + i * 0.7) % 9) / 1.6; // 0..1 while in the air
        const r = R + 22 + i * 2;
        d.position.set(Math.cos(base) * r, leap < 1 ? -0.8 + Math.sin(leap * Math.PI) * 2.6 : -3, Math.sin(base) * r);
        d.rotation.set(leap < 1 ? -Math.cos(leap * Math.PI) * 0.9 : 0, -base, 0, 'YXZ');
        d.visible = leap < 1.05;
      });
      boat.rotation.z = Math.sin(t * 0.9) * 0.06;
      crabs.forEach((c) => {
        // Scuttle sideways back and forth along the beach, legs rattling.
        const s = Math.sin(t * 0.6 + c.phase);
        const side = new THREE.Vector3(Math.cos(c.group.rotation.y), 0, -Math.sin(c.group.rotation.y));
        c.group.position.copy(c.home).addScaledVector(side, s * 3);
        c.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 18 + i) * 0.4 * Math.abs(Math.cos(t * 0.6 + c.phase))));
      });
      if (tt.group.visible) {
        // Crawls slowly down the beach to the sea, flippers rowing through the sand.
        turtleK = Math.min(1, turtleK + dt / 90);
        const d = 30 + turtleK * (R - 30);
        tt.group.position.set(Math.cos(turtleA) * d, 0, Math.sin(turtleA) * d);
        tt.group.rotation.y = Math.atan2(Math.cos(turtleA), Math.sin(turtleA));
        tt.flippers.forEach(({ p, s }, i) => (p.rotation.y = Math.sin(t * 2.4 + (i > 1 ? Math.PI : 0)) * 0.5 * s));
        tt.head.rotation.y = Math.sin(t * 0.8) * 0.3;
      }
      washU.uDim.value = night ? 0.4 : 1;
      // Is the swash over Byte's feet right now?
      const px = player.x - origin.x;
      const pz = player.z - origin.z;
      const pa = Math.atan2(pz, px);
      const wet = Math.hypot(px, pz) > SH - REACH * surge(pa, t) - 0.2;
      if (wet && !wasWet && active) {
        splash();
        rippleT = 0;
        ripple.position.set(px, 0.06, pz);
      }
      wasWet = wet;
      rippleT += dt;
      ripple.scale.setScalar(1 + rippleT * 2.2);
      ripple.material.opacity = Math.max(0, 0.8 - rippleT * 0.9);
      if (active) startSurf();
      if (surf) {
        const swell = 0.06 + Math.max(0, Math.sin(t * 0.55)) * 0.12;
        surf.g.gain.setTargetAtTime(active && soundOn() ? swell : 0, surf.ac.currentTime, 0.3);
      }
    },
  };
}
