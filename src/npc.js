import * as THREE from 'three';
import { Bot } from './bot.js';
import { textCanvas } from './world.js';

// Speech bubble: word-wrapped text on a rounded card, drawn to a canvas.
export function bubbleTexture(text) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 230;
  const g = c.getContext('2d');
  g.font = '500 30px "Space Grotesk", system-ui, sans-serif';
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > 560 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  const h = 40 + lines.length * 40;
  g.fillStyle = '#fffaf2';
  g.beginPath();
  g.roundRect(8, 8, 624, h, 28);
  g.moveTo(300, h + 6);
  g.lineTo(320, h + 34);
  g.lineTo(340, h + 6);
  g.fill();
  g.fillStyle = '#1b1b1f';
  g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, 40, 30 + i * 40));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class NPC {
  // def: { name, home: [x, z], wander, palette?, outfit?, flying?, scale?, speed?, roamAll? }
  constructor(def, scene) {
    this.def = def;
    this.bot = new Bot({ palette: def.palette, outfit: def.outfit, flying: def.flying });
    this.pos = this.bot.group.position;
    this.pos.set(def.home[0], 0, def.home[1]);
    this.scale = def.scale ?? 1.2;
    this.bot.group.scale.setScalar(this.scale);
    scene.add(this.bot.group);

    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(def.name, { w: 320, h: 96, size: 44 }), depthWrite: false }));
    this.tag.scale.set(3.4, 1, 1);
    scene.add(this.tag);

    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.bubble.scale.set(10, 3.6, 1);
    this.bubble.renderOrder = 2;
    scene.add(this.bubble);
    this.bubbleText = '';

    this.target = null;
    this.wait = Math.random() * 2;
    this.heading = Math.random() * Math.PI * 2;
    this.lead = null; // { pts: [{ x, z }...], onArrive }
    this.vel = new THREE.Vector3();
    // Stuck detection: if the bot stops getting closer to its goal, it picks another one.
    this.goalRef = null;
    this.bestDist = Infinity;
    this.stuckFor = 0;
  }

  say(text) {
    if (text === this.bubbleText) return;
    this.bubbleText = text;
    this.bubble.material.map?.dispose();
    this.bubble.material.map = bubbleTexture(text);
    this.bubble.material.needsUpdate = true;
  }

  // Walk a list of waypoints, waiting for the player to keep up; onArrive fires at the last one.
  guideTo(pts, onArrive) {
    this.lead = { pts: [...pts], onArrive };
  }

  update(dt, t, player, collide, randomSpot) {
    const toPlayer = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    let speed = 0;
    let goal = null;

    if (this.lead) {
      const next = this.lead.pts[0];
      if (next && Math.hypot(next.x - this.pos.x, next.z - this.pos.z) < 1.2) this.lead.pts.shift();
      if (!this.lead.pts.length) {
        const { onArrive } = this.lead;
        this.lead = null;
        this.wait = 6; // linger at the destination, then drift home
        onArrive?.();
      } else if (toPlayer < 11) {
        goal = this.lead.pts[0];
        speed = 10;
      }
    } else if (toPlayer < 5 && !this.def.roamAll) {
      // Stop and look at the player while they're close.
      this.heading = Math.atan2(player.x - this.pos.x, player.z - this.pos.z);
    } else {
      this.wait -= dt;
      if (this.wait <= 0 && !this.target) {
        this.target = this.def.roamAll
          ? randomSpot()
          : {
              x: this.def.home[0] + (Math.random() - 0.5) * 2 * this.def.wander,
              z: this.def.home[1] + (Math.random() - 0.5) * 2 * this.def.wander,
            };
      }
      if (this.target) {
        goal = this.target;
        speed = this.def.speed ?? 3;
        if (Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) < 0.6) {
          this.target = null;
          this.wait = 1.5 + Math.random() * 3;
        }
      }
    }

    // A goal inside a building or behind a tree can never be reached: give up instead of walking
    // into the wall forever.
    if (goal) {
      if (goal !== this.goalRef) {
        this.goalRef = goal;
        this.bestDist = Infinity;
        this.stuckFor = 0;
      }
      const d = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
      if (d < this.bestDist - 0.05) {
        this.bestDist = d;
        this.stuckFor = 0;
      } else if ((this.stuckFor += dt) > 1.1) {
        if (this.lead) this.lead.pts.shift(); // skip a waypoint that can't be reached
        else {
          this.target = null;
          this.wait = 0.4 + Math.random();
          this.heading += Math.PI * (0.6 + Math.random() * 0.8); // turn away from the obstacle
        }
        this.goalRef = null;
        goal = null;
      }
    }
    const want = new THREE.Vector3();
    if (goal) {
      want.set(goal.x - this.pos.x, 0, goal.z - this.pos.z).normalize().multiplyScalar(speed);
    }
    this.vel.lerp(want, Math.min(1, dt * 8));
    this.pos.addScaledVector(this.vel, dt);
    collide(this.pos, 0.8 * this.scale);
    const flat = Math.hypot(this.vel.x, this.vel.z);
    if (flat > 0.3) this.heading = Math.atan2(this.vel.x, this.vel.z);
    this.bot.animate(dt, t + this.def.home[0], Math.min(1, flat / 10), this.heading);

    const top = 3.6 * this.scale;
    this.tag.position.set(this.pos.x, top, this.pos.z);
    this.bubble.position.set(this.pos.x, top + 2.6, this.pos.z);
    const show = toPlayer < 9 && this.bubbleText;
    const m = this.bubble.material;
    m.opacity += ((show ? 1 : 0) - m.opacity) * Math.min(1, dt * 8);
    this.bubble.visible = m.opacity > 0.02;
    return toPlayer;
  }
}
