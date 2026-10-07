import * as THREE from 'three';
import { BENCH } from './data.js';

// Sunset Point: a bench on the eastern rim facing open sky (the sun sets in the east-west arc's +x
// end). Sit down and the camera settles over Byte's shoulder: by day Byte reads, by night it
// stargazes while shooting stars streak past.
export function createBench({ scene, addCollider }) {
  const facing = new THREE.Vector3(Math.cos(BENCH.angle), 0, Math.sin(BENCH.angle)); // looking out to sea
  const heading = Math.atan2(facing.x, facing.z);
  const g = new THREE.Group();
  g.position.set(BENCH.x, 0, BENCH.z);
  g.rotation.y = heading; // model is built facing +z
  scene.add(g);

  const wood = new THREE.MeshStandardMaterial({ color: '#9a6b44', roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.5, metalness: 0.6 });
  const part = (geo, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  for (let i = 0; i < 4; i++) part(new THREE.BoxGeometry(3.2, 0.09, 0.22), wood, 0, 0.82, -0.35 + i * 0.25); // seat slats
  for (let i = 0; i < 3; i++) part(new THREE.BoxGeometry(3.2, 0.2, 0.07), wood, 0, 1.25 + i * 0.27, -0.6, -0.18); // backrest
  [-1.4, 1.4].forEach((x) => {
    part(new THREE.BoxGeometry(0.1, 0.82, 0.1), iron, x, 0.41, 0.3);
    part(new THREE.BoxGeometry(0.1, 1.9, 0.1), iron, x, 0.95, -0.55, -0.18);
    part(new THREE.BoxGeometry(0.1, 0.08, 0.9), iron, x, 1.05, -0.05); // armrest
  });
  // A lamp beside the bench for reading after dusk.
  part(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 8), iron, 2.2, 1.7, -0.3);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffb64d', emissiveIntensity: 1.6 });
  part(new THREE.BoxGeometry(0.4, 0.5, 0.4), lampMat, 2.2, 3.5, -0.3);
  part(new THREE.ConeGeometry(0.36, 0.3, 4), iron, 2.2, 3.9, -0.3).rotation.y = Math.PI / 4;
  addCollider(BENCH.x, BENCH.z, 1.7);

  // Byte's book: navy cover, cream pages, one page that turns now and then.
  const book = new THREE.Group();
  const cover = new THREE.MeshStandardMaterial({ color: '#0c2d5e', roughness: 0.6 });
  const paper = new THREE.MeshStandardMaterial({ color: '#f6f0e1', roughness: 0.9, side: THREE.DoubleSide });
  [-1, 1].forEach((s) => {
    const half = new THREE.Group();
    half.rotation.z = s * 0.35;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.56), cover);
    c.position.x = s * 0.21;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.52), paper);
    p.position.set(s * 0.2, 0.03, 0);
    half.add(c, p);
    book.add(half);
  });
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.5), paper);
  page.geometry.translate(0.18, 0, 0);
  page.rotation.x = -Math.PI / 2;
  const pagePivot = new THREE.Group();
  pagePivot.position.y = 0.06;
  pagePivot.add(page);
  book.add(pagePivot);
  book.rotation.set(-1.1, 0, 0);
  book.position.set(-0.3, -0.05, 0.25);
  let flip = 0;

  // Shooting stars: bright streaks with fading tails across the sky ahead.
  const starMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, toneMapped: false, depthWrite: false, fog: false });
  const tailGeo = new THREE.PlaneGeometry(1, 0.08);
  tailGeo.translate(-0.5, 0, 0);
  const shooting = [];
  let nextStar = 1.5;
  const spawnStar = (origin) => {
    const m = new THREE.Mesh(tailGeo, starMat.clone());
    const side = new THREE.Vector3(-facing.z, 0, facing.x);
    const start = origin.clone().addScaledVector(facing, 90 + Math.random() * 60).addScaledVector(side, (Math.random() - 0.5) * 120);
    start.y = 45 + Math.random() * 35;
    const dir = side.clone().multiplyScalar(Math.random() < 0.5 ? 1 : -1).add(new THREE.Vector3(0, -0.35 - Math.random() * 0.3, 0)).normalize();
    m.position.copy(start);
    m.userData = { dir, life: 0, speed: 70 + Math.random() * 40 };
    scene.add(m);
    shooting.push(m);
  };

  return {
    spot: { x: BENCH.x - facing.x * 1.4, z: BENCH.z - facing.z * 1.4 },
    seat: { x: BENCH.x + facing.x * 0.15, z: BENCH.z + facing.z * 0.15, heading },
    facing,
    book,
    update(dt, t, { sitting, night, reading, camera }) {
      // Turn a page every few seconds while reading.
      if (reading) {
        flip += dt / 5;
        const k = flip % 1;
        pagePivot.rotation.z = k > 0.85 ? -((k - 0.85) / 0.15) * Math.PI * 0.95 : 0;
      }
      if (sitting && night && (nextStar -= dt) < 0) {
        spawnStar(camera.position);
        nextStar = 2 + Math.random() * 3.5;
      }
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        const u = s.userData;
        u.life += dt;
        s.position.addScaledVector(u.dir, u.speed * dt);
        s.lookAt(camera.position);
        // Stretch along the travel direction: a long tail that fades.
        const len = Math.min(18, u.life * 40);
        s.scale.set(len, 1.2, 1);
        s.rotation.z = Math.atan2(u.dir.y, Math.hypot(u.dir.x, u.dir.z)) * Math.sign(u.dir.x || 1);
        s.material.opacity = Math.max(0, 1 - u.life / 1.1);
        if (u.life > 1.1) {
          scene.remove(s);
          s.material.dispose();
          shooting.splice(i, 1);
        }
      }
    },
  };
}
