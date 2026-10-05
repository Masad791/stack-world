import * as THREE from 'three';
import { Bot } from './bot.js';
import { buildWorld, ISLAND_R } from './world.js';
import { ZONES, CONTACT, PORTFOLIO } from './data.js';

// 3D labels are drawn onto canvases once, so wait (briefly) for the brand font first.
await Promise.race([document.fonts?.load('600 54px "Space Grotesk"'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(`stackworld:${key}`)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`stackworld:${key}`, JSON.stringify(value));
    } catch {}
  },
};

// ---------- Renderer, scene, lights ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a8dcff');
scene.fog = new THREE.Fog('#a8dcff', 70, 150);

const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
scene.add(new THREE.HemisphereLight('#dff1ff', '#6f9e4f', 1.4));
const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const world = buildWorld(scene);
const bot = new Bot();
bot.group.position.set(0, 0, 9);
bot.group.scale.setScalar(1.35);
bot.group.rotation.y = Math.PI;
scene.add(bot.group);

// ---------- Sound: two tiny synthesized blips, no audio files ----------
let audio;
let soundOn = store.get('sound', true);
const blip = (from, to, dur = 0.18, type = 'triangle', vol = 0.12) => {
  if (!soundOn) return;
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(to, audio.currentTime + dur);
  g.gain.setValueAtTime(vol, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + dur);
};
const syncSound = () => {
  $('sound').textContent = soundOn ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', String(soundOn));
};
$('sound').onclick = () => {
  soundOn = !soundOn;
  store.set('sound', soundOn);
  syncSound();
};
syncSound();

// ---------- Progress (kept between visits) ----------
const taken = new Set(store.get('orbs', []));
const visited = new Set(store.get('zones', []));
world.orbs.forEach((o) => {
  if (taken.has(o.name)) {
    o.taken = true;
    o.group.visible = false;
  }
});
const updateStats = (pop) => {
  $('orb-count').textContent = taken.size;
  $('zone-count').textContent = visited.size;
  if (pop) {
    const el = $(pop).parentElement;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
};
updateStats();

let toastTimer;
const toast = (text) => {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1400);
};

// ---------- Panel ----------
const linkBtn = ([label, href], primary) =>
  `<a class="btn ${primary ? 'primary' : 'ghost'}" href="${href}" target="_blank" rel="noopener">${label}</a>`;
let panelKey = null;
const showPanel = (key, { kicker, title, text, img, tags = [], links = [] }) => {
  if (panelKey === key) return;
  panelKey = key;
  $('panel-kicker').textContent = kicker;
  $('panel-title').textContent = title;
  $('panel-text').textContent = text;
  $('panel-img').src = img || '';
  $('panel-img').alt = img ? title : '';
  $('panel-img').classList.toggle('show', Boolean(img));
  $('panel-tags').innerHTML = tags.map((t) => `<span>${t}</span>`).join('');
  $('panel-links').innerHTML = links.map((l, i) => linkBtn(l, i === 0)).join('');
  $('panel').classList.add('open');
};
const hidePanel = () => {
  if (panelKey === null) return;
  panelKey = null;
  $('panel').classList.remove('open');
};
$('finale-links').innerHTML = CONTACT.map((l, i) => linkBtn(l, i === 0)).join('');

// ---------- Input ----------
const keys = new Set();
let started = false;
let target = null; // click-to-walk destination
let zoom = 1;
const setZoom = (z) => (zoom = THREE.MathUtils.clamp(z, 0.6, 1.5));

addEventListener('keydown', (e) => {
  if (!started || e.target.closest?.('a, button')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys.add(k);
  if (k === ' ' && bot.jump()) blip(300, 600, 0.15, 'square', 0.05);
  if (k === '+' || k === '=') setZoom(zoom - 0.1);
  if (k === '-') setZoom(zoom + 0.1);
  target = null;
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  setZoom(zoom + Math.sign(e.deltaY) * 0.08);
}, { passive: false });
$('zoom-in').onclick = () => setZoom(zoom - 0.15);
$('zoom-out').onclick = () => setZoom(zoom + 0.15);

const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: '#ff4a1c', transparent: true, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
canvas.addEventListener('pointerdown', (e) => {
  if (!started) return;
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.ray.intersectPlane(ground, new THREE.Vector3());
  if (!hit || Math.hypot(hit.x, hit.z) > ISLAND_R - 2) return;
  target = hit;
  marker.position.set(hit.x, 0.08, hit.z);
  marker.visible = true;
  marker.scale.setScalar(1.4);
});

// Camera looks from the south-east at a fixed angle, so "up" on the keyboard means "away from the camera".
const CAM_DIR = new THREE.Vector3(1, 1.25, 1).normalize();
const FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();

// ---------- Physics ----------
const BOT_R = 1; // matches the 1.35x bot scale
const pos = bot.group.position;
const move = new THREE.Vector3();
let heading = Math.PI;

function step(dt) {
  move.set(0, 0, 0);
  if (keys.has('w') || keys.has('arrowup')) move.add(FORWARD);
  if (keys.has('s') || keys.has('arrowdown')) move.sub(FORWARD);
  if (keys.has('d') || keys.has('arrowright')) move.add(RIGHT);
  if (keys.has('a') || keys.has('arrowleft')) move.sub(RIGHT);
  if (move.lengthSq() === 0 && target) {
    move.set(target.x - pos.x, 0, target.z - pos.z);
    if (move.length() < 0.4) {
      target = null;
      marker.visible = false;
      move.set(0, 0, 0);
    }
  }
  const running = keys.has('shift') || (target && move.length() > 12);
  const speed = running ? 15 : 9;
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);
  bot.vel.lerp(move, Math.min(1, dt * 10));
  pos.addScaledVector(bot.vel, dt);

  // Push out of buildings, trees and props.
  for (const c of world.colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + BOT_R;
    if (d < min && d > 0.0001) {
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
    }
  }
  const fromCenter = Math.hypot(pos.x, pos.z);
  if (fromCenter > ISLAND_R - 2) pos.multiplyScalar((ISLAND_R - 2) / fromCenter);

  // Jump arc.
  bot.vy -= 25 * dt;
  bot.y = Math.max(0, bot.y + bot.vy * dt);
  if (bot.y === 0 && bot.vy < -6) bot.squash = 0.18; // landing squish
  if (bot.y === 0) bot.vy = Math.max(bot.vy, 0);

  const flat = Math.hypot(bot.vel.x, bot.vel.z);
  if (flat > 0.5) heading = Math.atan2(bot.vel.x, bot.vel.z);
  return Math.min(1, flat / 15);
}

// ---------- Discovery: districts, billboards, orbs ----------
function discover() {
  // Billboards first: they sit inside Projects Avenue and are more specific.
  const board = world.billboards.find((b) => Math.hypot(pos.x - b.x, pos.z - b.z) < 3.2);
  if (board) {
    const p = board.project;
    showPanel(`project:${p.id}`, {
      kicker: `Project ${p.num}`,
      title: p.title,
      text: p.text,
      img: p.img,
      links: [['Open case study', `${PORTFOLIO}/project/${p.id}`]],
    });
  }
  const zone = ZONES.find((z) => Math.hypot(pos.x - z.x, pos.z - z.z) < z.r);
  // Fade the floating name of the district you're standing in, so it never hides Byte.
  ZONES.forEach((z) => {
    const m = z.label.material;
    m.opacity += ((z === zone ? 0.15 : 1) - m.opacity) * 0.1;
  });
  if (zone) {
    if (!visited.has(zone.id)) {
      visited.add(zone.id);
      store.set('zones', [...visited]);
      updateStats('zone-count');
      toast(`Discovered ${zone.name}`);
      blip(440, 880, 0.3, 'sine', 0.1);
    }
    if (!board) {
      showPanel(`zone:${zone.id}`, {
        kicker: zone.name,
        title: zone.title,
        text: zone.text,
        tags: zone.tags,
        links: zone.contact ? CONTACT : zone.id === 'plaza' ? [['Open the portfolio', PORTFOLIO]] : [],
      });
    }
  } else if (!board) {
    hidePanel();
  }

  for (const o of world.orbs) {
    if (o.taken || Math.hypot(pos.x - o.x, pos.z - o.z) > 1.9) continue;
    o.taken = true;
    taken.add(o.name);
    store.set('orbs', [...taken]);
    burst(o.group.position);
    o.group.visible = false;
    updateStats('orb-count');
    toast(`+ ${o.name}`);
    blip(660, 1320, 0.22);
    if (taken.size === world.orbs.length) setTimeout(() => $('finale').classList.remove('hidden'), 700);
  }
}

// ---------- Particles: dust behind the bot and confetti bursts ----------
const PARTS = 120;
const partGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const parts = new THREE.InstancedMesh(partGeo, new THREE.MeshBasicMaterial({ vertexColors: false }), PARTS);
parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const pdata = Array.from({ length: PARTS }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color() }));
let pnext = 0;
scene.add(parts);
const spawn = (p, v, color, life) => {
  const d = pdata[pnext];
  pnext = (pnext + 1) % PARTS;
  d.p.copy(p);
  d.v.copy(v);
  d.c.set(color);
  d.life = life;
};
const CONFETTI = ['#ff4a1c', '#ffd166', '#61dafb', '#41b883', '#c792ea'];
function burst(at) {
  for (let i = 0; i < 26; i++) {
    const v = new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 6, (Math.random() - 0.5) * 8);
    spawn(at, v, CONFETTI[i % CONFETTI.length], 1.1);
  }
}
const m4 = new THREE.Matrix4();
let dustClock = 0;
function updateParticles(dt, speed01) {
  dustClock += dt;
  if (speed01 > 0.35 && bot.y === 0 && dustClock > 0.05) {
    dustClock = 0;
    spawn(new THREE.Vector3(pos.x, 0.15, pos.z), new THREE.Vector3((Math.random() - 0.5), 1.2, (Math.random() - 0.5)), '#e9dcc0', 0.5);
  }
  pdata.forEach((d, i) => {
    if (d.life > 0) {
      d.life -= dt;
      d.v.y -= 14 * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.1) {
        d.p.y = 0.1;
        d.v.multiplyScalar(0.5);
      }
    }
    const s = Math.max(0, Math.min(1, d.life * 2));
    m4.makeScale(s, s, s).setPosition(d.p);
    parts.setMatrixAt(i, m4);
    parts.setColorAt(i, d.c);
  });
  parts.instanceMatrix.needsUpdate = true;
  if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
}

// ---------- Minimap (rotated so "up" matches the camera's forward) ----------
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const S = 300;
  const k = (S / 2 - 12) / ISLAND_R;
  const to = (x, z) => [S / 2 + ((x - z) / Math.SQRT2) * k, S / 2 + ((x + z) / Math.SQRT2) * k];
  mm.clearRect(0, 0, S, S);
  mm.fillStyle = '#9ad57a';
  mm.beginPath();
  mm.arc(S / 2, S / 2, ISLAND_R * k, 0, Math.PI * 2);
  mm.fill();
  ZONES.forEach((z) => {
    const [x, y] = to(z.x, z.z);
    mm.fillStyle = visited.has(z.id) ? z.color : 'rgba(27,27,31,0.25)';
    mm.beginPath();
    mm.arc(x, y, z.r * k, 0, Math.PI * 2);
    mm.fill();
  });
  mm.fillStyle = '#ffffff';
  world.orbs.forEach((o) => {
    if (o.taken) return;
    const [x, y] = to(o.x, o.z);
    mm.beginPath();
    mm.arc(x, y, 4, 0, Math.PI * 2);
    mm.fill();
  });
  const [bx, by] = to(pos.x, pos.z);
  mm.save();
  mm.translate(bx, by);
  // Screen angle of the bot's heading in minimap space.
  mm.rotate(Math.atan2((Math.sin(heading) + Math.cos(heading)) / Math.SQRT2, (Math.sin(heading) - Math.cos(heading)) / Math.SQRT2) + Math.PI / 2);
  mm.fillStyle = '#1b1b1f';
  mm.beginPath();
  mm.moveTo(0, -11);
  mm.lineTo(8, 8);
  mm.lineTo(0, 4);
  mm.lineTo(-8, 8);
  mm.closePath();
  mm.fill();
  mm.restore();
}

// ---------- Loop ----------
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const clock = new THREE.Clock();
let frame = 0;

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Phones in portrait get a wider field of view so the world still fits.
  camera.fov = w < h ? 55 : 40;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function frameCamera(dt, snap) {
  const dist = 40 * zoom;
  camPos.copy(pos).addScaledVector(CAM_DIR, dist);
  if (snap) camera.position.copy(camPos);
  else camera.position.lerp(camPos, Math.min(1, dt * 4));
  lookAt.lerp(new THREE.Vector3(pos.x, 1.5, pos.z), snap ? 1 : Math.min(1, dt * 6));
  camera.lookAt(lookAt);
  sun.position.set(pos.x + 25, 40, pos.z + 12);
  sun.target.position.set(pos.x, 0, pos.z);
}
lookAt.set(pos.x, 1.5, pos.z);
frameCamera(0, true);

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;
  world.update(t, dt);
  const speed01 = started ? step(dt) : 0;
  bot.animate(dt, t, speed01, heading);
  if (started) discover();
  updateParticles(dt, speed01);
  if (marker.visible) marker.scale.setScalar(THREE.MathUtils.lerp(marker.scale.x, 1, dt * 8));
  frameCamera(dt, false);
  if (++frame % 3 === 0) drawMinimap();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// ---------- Start ----------
$('start').disabled = false;
$('start').textContent = taken.size || visited.size ? 'Continue exploring' : 'Start exploring';
const start = () => {
  started = true;
  document.activeElement?.blur(); // otherwise the hidden button keeps focus and swallows WASD
  $('intro').classList.add('hidden');
  blip(330, 660, 0.25, 'sine', 0.08);
  setTimeout(() => $('hint').style.opacity = '0', 9000);
};
$('start').onclick = start;
if (import.meta.env.DEV) window.__sw = { pos, start, world }; // dev-only hook for testing; stripped from builds
$('keep-playing').onclick = () => $('finale').classList.add('hidden');
if (matchMedia('(pointer: coarse)').matches) $('hint').textContent = 'Tap the ground to walk there. Walk into districts and billboards to read about them.';
