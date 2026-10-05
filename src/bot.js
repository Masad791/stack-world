import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const ACCENT = 0xff4a1c;

// Byte: a small rounded robot built from primitives, so the game ships with no model files.
export class Bot {
  constructor() {
    this.group = new THREE.Group(); // position + heading
    this.body = new THREE.Group(); // bob, lean and squash
    this.group.add(this.body);

    const white = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.5 });
    const glow = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2 });
    const shadow = (m) => ((m.castShadow = true), m);

    const torso = shadow(new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.9, 0.8, 4, 0.22), white));
    torso.position.y = 1.05;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.14, 0.84), accent);
    belt.position.y = 0.72;

    this.head = new THREE.Group();
    this.head.position.y = 1.95;
    const skull = shadow(new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.05, 1.15, 5, 0.32), white));
    const visor = new THREE.Mesh(new RoundedBoxGeometry(1.22, 0.66, 0.1, 4, 0.12), dark);
    visor.position.set(0, -0.02, 0.56);
    const eyeGeo = new THREE.CapsuleGeometry(0.075, 0.14, 4, 8);
    this.eyes = [-0.26, 0.26].map((x) => {
      const eye = new THREE.Mesh(eyeGeo, glow);
      eye.position.set(x, 0, 0.62);
      return eye;
    });
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45), dark);
    antenna.position.y = 0.72;
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), glow);
    this.tip.position.y = 0.98;
    const ears = [-0.8, 0.8].map((x) => {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16), accent);
      ear.rotation.z = Math.PI / 2;
      ear.position.x = x;
      return ear;
    });
    this.head.add(skull, visor, ...this.eyes, antenna, this.tip, ...ears);

    const limb = (len, r, mat) => {
      const pivot = new THREE.Group();
      const mesh = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat));
      mesh.position.y = -len / 2 - r * 0.5;
      pivot.add(mesh);
      return pivot;
    };
    this.arms = [-0.68, 0.68].map((x) => {
      const arm = limb(0.42, 0.13, white);
      arm.position.set(x, 1.32, 0);
      return arm;
    });
    this.legs = [-0.27, 0.27].map((x) => {
      const leg = limb(0.32, 0.16, dark);
      leg.position.set(x, 0.62, 0);
      return leg;
    });

    this.body.add(torso, belt, this.head, ...this.arms, ...this.legs);

    // Soft blob shadow keeps the bot readable on any surface.
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
    );
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
  }

  jump() {
    if (this.y > 0.01) return false;
    this.vy = 8.5;
    this.squash = -0.25;
    return true;
  }

  // speed01: 0 idle .. 1 full run. Called once per frame after physics.
  animate(dt, t, speed01, heading) {
    // Turn toward the travel direction along the shortest arc.
    let d = heading - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, dt * 12);

    this.phase += dt * (4 + speed01 * 12);
    const swing = Math.sin(this.phase) * 0.9 * speed01;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.8;
    this.arms[1].rotation.x = swing * 0.8;
    this.arms[0].rotation.z = -0.15 - speed01 * 0.1;
    this.arms[1].rotation.z = 0.15 + speed01 * 0.1;

    const bob = Math.abs(Math.sin(this.phase)) * 0.12 * speed01 + Math.sin(t * 2) * 0.03 * (1 - speed01);
    this.body.position.y = this.y + bob;
    this.body.rotation.x = speed01 * 0.18; // lean into the run
    this.head.rotation.z = Math.sin(t * 1.6) * 0.05 * (1 - speed01);
    this.tip.position.y = 0.98 + Math.sin(t * 6) * 0.03;

    // Squash and stretch for jumps and landings.
    this.squash += (0 - this.squash) * Math.min(1, dt * 10);
    const s = 1 + this.squash;
    this.body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));

    // Blink every few seconds.
    this.blinkAt -= dt;
    const closed = this.blinkAt < 0.12;
    this.eyes.forEach((e) => (e.scale.y = closed ? 0.15 : 1));
    if (this.blinkAt < 0) this.blinkAt = 2 + Math.random() * 3;

    const air = Math.min(1, this.y / 2);
    this.blob.scale.setScalar(1 - air * 0.5);
    this.blob.material.opacity = 0.18 * (1 - air * 0.6);
  }
}
