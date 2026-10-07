import * as THREE from 'three';
import { Bot } from './bot.js';
import { NPC } from './npc.js';
import { createGames } from './games.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld, ISLAND_R, textCanvas } from './world.js';
import { createNature, MOODS, MOOD_ORDER } from './nature.js';
import { createMusic } from './music.js';
import { createSecrets } from './secrets.js';
import { createWeather } from './weather.js';
import { createGuestbook } from './guestbook.js';
import { createSky } from './sky.js';
import { createArt } from './art.js';
import { createBench } from './bench.js';
import { createForest } from './forest.js';
import { snapshot, batchStatic, compactRigs, SWAY_TIME } from './perf.js';
import { createNav } from './pathfind.js';
import { makeGate, tickGates } from './realmkit.js';
import { buildRome } from './rome.js';
import { buildPeaks } from './peaks.js';
import { buildCoast } from './coast.js';
import { SONG_NAMES } from './music.js';
import { ZONES, CONTACT, PORTFOLIO, HELPERS, FACTS, BADGES, ARENA, GROVE, SECRETS, FOREST, ANIMALS, GATE, REALMS } from './data.js';

// 3D labels are drawn onto canvases once, so wait (briefly) for the brand font first.
await Promise.race([document.fonts?.load('600 54px "Space Grotesk"'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

const $ = (id) => document.getElementById(id);
// Corner buttons hold an SVG icon plus a .lbl span; only the label text changes.
const label = (id, text) => ($(id).querySelector('.lbl').textContent = text);
const touch = matchMedia('(pointer: coarse)').matches;
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
const hemi = new THREE.HemisphereLight('#dff1ff', '#6f9e4f', 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const world = buildWorld(scene);
// The island floats: rock underside, cloud sea below, islets and passing planes.
const sky = createSky({ scene, islandR: ISLAND_R, getAudio: () => getAudio(), soundOn: () => soundOn, started: () => started });

// Bloom makes lamps, lanterns, fireflies and the bots' eyes glow. Skipped on touch devices to save their GPUs.
let composer = null;
let bloom = null;
let art = null;
if (!touch) {
  // 4x MSAA on the composer's target: post-processing otherwise renders without anti-aliasing.
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.6, 0.88);
  composer.addPass(bloom);
  // Painterly styles for the secret places, between bloom and the final tone mapping.
  art = createArt();
  composer.addPass(art.pass);
  composer.addPass(new OutputPass());
  document.body.classList.add('gl-art'); // the CSS filter fallback steps aside
}
const secrets = createSecrets({ scene, addCollider: world.addCollider, light: () => sun.intensity, camera });
const nature = createNature({ scene, hemi, sun, renderer, bloom, sea: sky.sea, islandTop: world.islandTop, islandR: ISLAND_R, addCollider: world.addCollider });
const bot = new Bot();
bot.group.position.set(0, 0, 9);
bot.group.scale.setScalar(1.35);
bot.group.rotation.y = Math.PI;
scene.add(bot.group);
const pos = bot.group.position;

// Push a point out of every building, tree and prop, and keep it on the island.
// The walkable area of the island (or other map) Byte is on: a circle.
let realm = { id: 'home', x: 0, z: 0, r: ISLAND_R - 2 };
const nav = createNav(() => world.colliders);

function collide(p, r) {
  for (const c of world.colliders) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + r;
    if (d < min && d > 0.0001) {
      p.x = c.x + (dx / d) * min;
      p.z = c.z + (dz / d) * min;
    }
  }
  const dx = p.x - realm.x;
  const dz = p.z - realm.z;
  const fromCenter = Math.hypot(dx, dz);
  if (fromCenter > realm.r) {
    p.x = realm.x + (dx / fromCenter) * realm.r;
    p.z = realm.z + (dz / fromCenter) * realm.r;
  }
}

// ---------- Helper bots and roaming drones ----------
const BUBBLES = {
  scout: 'Need a tour? I can walk you anywhere.',
  bugsy: 'Bugs got loose in my arena! Help?',
  quizzy: 'Quiz time? Five questions, no pressure.',
  dash: 'Race me through the deploy rings!',
  hiro: 'Hiring? Asad is available.',
};
const helpers = HELPERS.map((def) => {
  const npc = new NPC(def, scene);
  npc.say(BUBBLES[def.id]);
  return npc;
});
const drones = [0, 1, 2].map((i) => {
  const spot = world.randomSpot();
  const glow = [0x7fc4ff, 0x8af0c0, 0xffd58a][i];
  const npc = new NPC({ name: `Drone ${i + 1}`, home: [spot.x, spot.z], roamAll: true, flying: true, scale: 0.75, speed: 5, palette: { shell: 0xf7f9fc, dark: 0x1d2a44, accent: glow, glow } }, scene);
  npc.factIndex = i * 3;
  npc.say(FACTS[npc.factIndex % FACTS.length]);
  return npc;
});
const allBots = [...helpers, ...drones];

// ---------- Sound: tiny synthesized blips, no audio files ----------
let audio;
let soundOn = store.get('sound', true);
const getAudio = () => (audio ??= new (window.AudioContext || window.webkitAudioContext)());
const music = createMusic(getAudio);
const blip = (from, to, dur = 0.18, type = 'triangle', vol = 0.12) => {
  if (!soundOn) return;
  getAudio();
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
  label('sound', soundOn ? 'Sound on' : 'Sound off');
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
const talked = new Set(store.get('talked', []));
const badges = new Set(store.get('badges', []));
const found = new Set(store.get('secrets', []));
const spotted = new Set(store.get('animals', []));
world.orbs.forEach((o) => {
  if (taken.has(o.name)) {
    o.taken = true;
    o.group.visible = false;
  }
});
const pop = (id) => {
  const el = $(id).parentElement;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
};
const updateStats = (changed) => {
  $('orb-count').textContent = taken.size;
  $('zone-count').textContent = visited.size;
  $('badge-count').textContent = badges.size;
  $('badge-total').textContent = BADGES.length;
  $('secret-count').textContent = found.size;
  if (changed) pop(changed);
};
updateStats();

let toastTimer;
const toast = (text) => {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1600);
};

function award(id) {
  if (badges.has(id)) return;
  badges.add(id);
  store.set('badges', [...badges]);
  updateStats('badge-count');
  const [, name] = BADGES.find(([b]) => b === id);
  setTimeout(() => {
    toast(`Badge unlocked: ${name}`);
    blip(523, 1046, 0.4, 'sine', 0.12);
  }, 400);
}

// ---------- Panel: district info, dialogs, games ----------
let panelKey = null;
let lock = null; // set while a dialog or game owns the panel; { x, z } closes it when you walk away
const renderAction = (a, i) =>
  a.href
    ? `<a class="btn ${a.primary || i === 0 ? 'primary' : 'ghost'}" href="${a.href}" target="_blank" rel="noopener">${a.label}</a>`
    : `<button type="button" class="btn ${a.primary ? 'primary' : 'ghost'}" data-a="${i}">${a.label}</button>`;
function showPanel(key, { kicker, title, text, img, tags = [], actions = [] }) {
  if (panelKey === key) return;
  panelKey = key;
  $('panel-kicker').textContent = kicker;
  $('panel-title').textContent = title;
  $('panel-text').textContent = text;
  $('panel-img').src = img || '';
  $('panel-img').alt = img ? title : '';
  $('panel-img').classList.toggle('show', Boolean(img));
  $('panel-tags').innerHTML = tags.map((t) => `<span>${t}</span>`).join('');
  $('panel-links').innerHTML = actions.map(renderAction).join('');
  $('panel-links').querySelectorAll('button[data-a]').forEach((b) => {
    b.onclick = () => actions[Number(b.dataset.a)].run();
  });
  $('panel').classList.add('open');
}
function hidePanel() {
  if (panelKey === null) return;
  panelKey = null;
  $('panel').classList.remove('open');
}
const openLocked = (key, opts, anchor = {}) => {
  lock = anchor;
  showPanel(key, opts);
};
const closePanel = () => {
  lock = null;
  hidePanel();
};
const links = (list) => list.map(([label, href], i) => ({ label, href, primary: i === 0 }));
$('finale-links').innerHTML = links(CONTACT).map(renderAction).join('');

// ---------- Minigames ----------
const games = createGames({
  scene,
  player: pos,
  store,
  award,
  ui: {
    bar: (text) => {
      $('gamebar-text').textContent = text;
      $('gamebar').classList.add('show');
    },
    clearBar: () => $('gamebar').classList.remove('show'),
    toast,
    blip,
    burst: (at, colors) => burst(at, colors),
    panel: (key, opts) => openLocked(key, opts),
    closePanel,
  },
});
$('gamebar-quit').onclick = () => {
  games.stop();
  toast('Game stopped');
};

// ---------- Talking to helper bots ----------
let compassOn = store.get('compass', false);
const syncCompass = () => {
  label('compass', compassOn ? 'Compass on' : 'Compass');
  $('compass').setAttribute('aria-pressed', String(compassOn));
};
const toggleCompass = () => {
  compassOn = !compassOn;
  store.set('compass', compassOn);
  syncCompass();
  toast(compassOn ? 'The arrow points to the nearest orb' : 'Compass off');
};
$('compass').onclick = toggleCompass;
syncCompass();

function talk(npc) {
  if (npc === BOARD) return guestbook.open();
  if (npc === SEAT) return sitDown();
  if (npc === GATE_SPOT) return openGateMenu();
  if (npc === SAGE) return openLocked(`sage:${Date.now()}`, { ...place.npc.info, actions: [{ label: 'Leave him be', run: closePanel }] }, place.npc);
  const { def } = npc;
  if (!talked.has(def.id)) {
    talked.add(def.id);
    store.set('talked', [...talked]);
    if (talked.size === HELPERS.length) award('social');
  }
  blip(392, 587, 0.15, 'sine', 0.08);
  const bye = { label: 'Bye', run: closePanel };
  const best = (k, fmt) => {
    const v = store.get(`best:${k}`, null);
    return v === null ? '' : ` Your best: ${fmt(v)}.`;
  };
  let actions = [bye];
  let text = def.greet;
  if (def.role === 'guide') {
    actions = [
      ...[...ZONES.filter((z) => z.id !== 'plaza'), GROVE].map((z) => ({
        label: z.name,
        run: () => {
          closePanel();
          // Every district sits at the end of a path from the plaza: circle the fountain to that
          // path (a straight line would walk into it), then follow the path to the district's edge.
          const d = Math.hypot(z.x, z.z);
          const stop = (d - z.r + 2) / d;
          const goalA = Math.atan2(z.x, z.z);
          let a = Math.atan2(npc.pos.x, npc.pos.z);
          const pts = [];
          for (let i = 0; i < 12; i++) {
            const diff = Math.atan2(Math.sin(goalA - a), Math.cos(goalA - a));
            if (Math.abs(diff) < 0.3) break;
            a += Math.sign(diff) * Math.min(0.5, Math.abs(diff));
            pts.push({ x: Math.sin(a) * 8.6, z: Math.cos(a) * 8.6 });
          }
          pts.push({ x: Math.sin(goalA) * 8.6, z: Math.cos(goalA) * 8.6 }, { x: z.x * stop, z: z.z * stop });
          npc.guideTo(pts, () => {
            npc.say(`Here's ${z.name}! Walk in to read about it.`);
            setTimeout(() => npc.say(BUBBLES.scout), 7000);
          });
          npc.say('Follow me!');
          toast(`Follow Scout to ${z.name}`);
        },
      })),
      { label: compassOn ? 'Turn off the orb compass' : 'Turn on the orb compass', run: () => (toggleCompass(), closePanel()) },
      bye,
    ];
    text += ' Pick a district, or let me switch on a compass that points to the nearest stack orb.';
  } else if (def.role === 'bugs') {
    text += best('bugs', (v) => `${v} bugs`);
    actions = [{ label: 'Start Bug Squash', primary: true, run: () => games.start('bugs') }, bye];
  } else if (def.role === 'quiz') {
    text += best('quiz', (v) => `${v}/5`);
    actions = [{ label: 'Start the quiz', primary: true, run: () => games.start('quiz') }, bye];
  } else if (def.role === 'race') {
    text += best('race', (v) => `${Number(v).toFixed(1)} s`);
    actions = [{ label: 'Start the race', primary: true, run: () => games.start('race') }, bye];
  } else if (def.role === 'hire') {
    actions = [...links(CONTACT), bye];
  }
  openLocked(`talk:${def.id}:${Date.now()}`, { kicker: `${def.name} // helper bot`, title: `Hi, I'm ${def.name}`, text, actions }, npc.pos);
}

// ---------- Input ----------
const keys = new Set();
let started = false;
let target = null; // click-to-walk: the next waypoint
let route = []; // the waypoints after it
let zoom = 1;
let nearby = null; // helper bot within talking range
const setZoom = (z) => (zoom = THREE.MathUtils.clamp(z, 0.6, 1.5));

addEventListener('keydown', (e) => {
  if (!started || e.target.closest?.('a, button, input, textarea') || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (sitting && (k === 'e' || k === 'escape' || k === ' ' || ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k))) return standUp();
  if (k === 'e' && nearby) return talk(nearby);
  if (k === 'escape') return closePanel();
  if (k === 'm') return cycleMood();
  if (k === 'v') return cycleView();
  if (k === 'r') return weather.cycle();
  keys.add(k);
  if (k === ' ' && bot.jump()) blip(300, 600, 0.15, 'square', 0.05);
  if (k === '+' || k === '=') setZoom(zoom - 0.1);
  if (k === '-') setZoom(zoom + 0.1);
  target = null;
  route = [];
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  setZoom(zoom + Math.sign(e.deltaY) * 0.08);
}, { passive: false });
// A touchpad pinch arrives as ctrl+wheel. Anywhere on the page (buttons, intro, panel) it zooms the
// camera, never the page: a pinch-zoomed page pushes the map and right-hand buttons off screen.
addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  if (e.target !== canvas) setZoom(zoom + Math.sign(e.deltaY) * 0.08);
}, { passive: false });
addEventListener('gesturestart', (e) => e.preventDefault()); // Safari's pinch
// If the page is zoomed anyway (touch screens, browser quirks), keep the HUD inside the visible part.
const vv = window.visualViewport;
const followViewport = () => {
  const root = document.documentElement;
  const offsets = {
    '--vv-top': vv.offsetTop,
    '--vv-left': vv.offsetLeft,
    '--vv-right': root.clientWidth - vv.offsetLeft - vv.width,
    '--vv-bottom': root.clientHeight - vv.offsetTop - vv.height,
  };
  for (const [k, v] of Object.entries(offsets)) root.style.setProperty(k, `${Math.max(0, v)}px`);
};
vv?.addEventListener('resize', followViewport);
vv?.addEventListener('scroll', followViewport);
$('zoom-in').onclick = () => setZoom(zoom - 0.15);
$('zoom-out').onclick = () => setZoom(zoom + 0.15);
$('prompt').onclick = () => nearby && talk(nearby);

const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: '#ff4a1c', transparent: true, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
function walkTo(clientX, clientY) {
  const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.ray.intersectPlane(ground, new THREE.Vector3());
  if (!hit || Math.hypot(hit.x - realm.x, hit.z - realm.z) > realm.r) return;
  // Find a way there around trees, buildings and fences (A*), not just a straight line.
  route = nav.path(pos, hit, realm, BOT_R + 0.1);
  if (!route) return;
  target = route.shift();
  const end = route.length ? route[route.length - 1] : target;
  marker.position.set(end.x, 0.08, end.z);
  marker.visible = true;
  marker.scale.setScalar(1.4);
}

// ---------- Camera: drag to orbit and tilt, click (without dragging) to walk ----------
let camYaw = Math.PI / 4; // starts from the south-east, like a city builder
let camPitch = 0.72;
const camDir = new THREE.Vector3();
const FORWARD = new THREE.Vector3(); // "up" on the keyboard: away from the camera
const RIGHT = new THREE.Vector3();
const updateCamAxes = () => {
  camDir.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
  FORWARD.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  RIGHT.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
};
updateCamAxes();
const pointers = new Map(); // pointerId -> { x, y, sx, sy }
let dragged = false;
let pinchFrom = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (!started) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  dragged = pointers.size > 1;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchFrom = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2) {
    // Two fingers: pinch to zoom.
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchFrom) setZoom(zoom * (pinchFrom / d) ** 0.6);
    pinchFrom = d;
    return;
  }
  if (!dragged && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6) return;
  dragged = true;
  canvas.style.cursor = 'grabbing';
  camYaw -= dx * 0.006;
  camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, 0.28, 1.35);
  updateCamAxes();
});
const release = (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  pinchFrom = 0;
  canvas.style.cursor = '';
  if (!dragged && e.type === 'pointerup' && e.button === 0) {
    if (sitting) standUp();
    else walkTo(e.clientX, e.clientY);
  }
  if (!pointers.size) dragged = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// ---------- Physics ----------
const BOT_R = 1; // matches the 1.35x bot scale
const move = new THREE.Vector3();
let heading = Math.PI;

function step(dt) {
  if (sitting) return 0;
  move.set(0, 0, 0);
  if (keys.has('w') || keys.has('arrowup')) move.add(FORWARD);
  if (keys.has('s') || keys.has('arrowdown')) move.sub(FORWARD);
  if (keys.has('d') || keys.has('arrowright')) move.add(RIGHT);
  if (keys.has('a') || keys.has('arrowleft')) move.sub(RIGHT);
  if (move.lengthSq() === 0 && target) {
    move.set(target.x - pos.x, 0, target.z - pos.z);
    // Corners along the route can be cut a little; the last point is reached exactly.
    if (move.length() < (route.length ? 0.9 : 0.4)) {
      target = route.shift() ?? null;
      if (!target) {
        marker.visible = false;
        move.set(0, 0, 0);
      } else move.set(target.x - pos.x, 0, target.z - pos.z);
    }
  }
  const running = keys.has('shift') || (target && (route.length > 1 || move.length() > 12));
  const speed = running ? 15 : 9;
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);
  bot.vel.lerp(move, Math.min(1, dt * 10));
  pos.addScaledVector(bot.vel, dt);
  collide(pos, BOT_R);
  // Bump gently off the other bots too.
  for (const n of allBots) {
    const dx = pos.x - n.pos.x;
    const dz = pos.z - n.pos.z;
    const d = Math.hypot(dx, dz);
    const min = BOT_R + 0.8 * n.scale;
    if (d < min && d > 0.0001) {
      pos.x = n.pos.x + (dx / d) * min;
      pos.z = n.pos.z + (dz / d) * min;
    }
  }

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
let artStyle = null;
let artPlace = null; // the secret place we're standing in, for the camera's cinematic push-in
let focus = 0;
function discover() {
  // Secret places: discovery, plus each one's own art style while you're inside.
  const secret = secrets.at(pos);
  const style = secret ? secret.style : null;
  artPlace = secret;
  if (style !== artStyle) {
    if (artStyle) document.body.classList.remove(`style-${artStyle}`);
    if (style) document.body.classList.add(`style-${style}`);
    art?.setStyle(style);
    artStyle = style;
  }
  if (secret && !found.has(secret.id)) {
    found.add(secret.id);
    store.set('secrets', [...found]);
    updateStats('secret-count');
    toast(`Secret found: ${secret.name}`);
    blip(392, 1175, 0.6, 'sine', 0.12);
    if (found.size === SECRETS.length) award('wanderer');
  }
  if (secret && !lock) {
    showPanel(`secret:${secret.id}`, { kicker: 'Secret place', title: secret.name, text: secret.line });
    return collectOrbs();
  }

  const zone = ZONES.find((z) => Math.hypot(pos.x - z.x, pos.z - z.z) < z.r);
  // Fade the floating name of the district you're standing in, so it never hides Byte.
  ZONES.forEach((z) => {
    const m = z.label.material;
    m.opacity += ((z === zone ? 0.15 : 1) - m.opacity) * 0.1;
  });
  if (zone && !visited.has(zone.id)) {
    visited.add(zone.id);
    store.set('zones', [...visited]);
    updateStats('zone-count');
    toast(`Discovered ${zone.name}`);
    blip(440, 880, 0.3, 'sine', 0.1);
    if (visited.size === ZONES.length) award('explorer');
  }

  // A dialog or game owns the panel until you close it or walk away from who you talked to.
  if (lock) {
    if (lock.x !== undefined && Math.hypot(pos.x - lock.x, pos.z - lock.z) > 9) closePanel();
  } else {
    const board = world.billboards.find((b) => Math.hypot(pos.x - b.x, pos.z - b.z) < 3.2);
    if (board) {
      const p = board.project;
      showPanel(`project:${p.id}`, {
        kicker: `Project ${p.num}`,
        title: p.title,
        text: p.text,
        img: p.img,
        actions: links([['Open case study', `${PORTFOLIO}/project/${p.id}`]]),
      });
    } else if (zone) {
      showPanel(`zone:${zone.id}`, {
        kicker: zone.name,
        title: zone.title,
        text: zone.text,
        tags: zone.tags,
        actions: zone.contact ? links(CONTACT) : zone.id === 'plaza' ? links([['Open the portfolio', PORTFOLIO]]) : [],
      });
    } else {
      hidePanel();
    }
  }

  collectOrbs();
}

function collectOrbs() {
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
    if (taken.size === world.orbs.length) {
      award('collector');
      setTimeout(() => $('finale').classList.remove('hidden'), 900);
    }
  }
}

// ---------- Particles: dust behind the bot and confetti bursts ----------
const PARTS = 160;
const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshBasicMaterial(), PARTS);
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
function burst(at, colors = CONFETTI) {
  for (let i = 0; i < 26; i++) {
    const v = new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 6, (Math.random() - 0.5) * 8);
    spawn(at, v, colors[i % colors.length], 1.1);
  }
}
const m4 = new THREE.Matrix4();
let dustClock = 0;
function updateParticles(dt, speed01) {
  dustClock += dt;
  if (speed01 > 0.35 && bot.y === 0 && dustClock > 0.05) {
    dustClock = 0;
    spawn(new THREE.Vector3(pos.x, 0.15, pos.z), new THREE.Vector3(Math.random() - 0.5, 1.2, Math.random() - 0.5), '#e9dcc0', 0.5);
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

// ---------- Compass arrow on the ground next to Byte ----------
const arrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.6, 1.6, 3),
  new THREE.MeshBasicMaterial({ color: '#ff4a1c', transparent: true, opacity: 0.9, depthWrite: false })
);
arrow.geometry.rotateX(Math.PI / 2); // point along +z
arrow.scale.y = 0.35; // flatten it onto the ground
scene.add(arrow);
function updateArrow(t) {
  let goal = games.pointer;
  if (!goal && compassOn && !games.active) {
    let best = Infinity;
    for (const o of world.orbs) {
      const d = o.taken ? Infinity : Math.hypot(o.x - pos.x, o.z - pos.z);
      if (d < best) {
        best = d;
        goal = o;
      }
    }
  }
  arrow.visible = Boolean(goal) && started;
  if (!arrow.visible) return;
  const a = Math.atan2(goal.x - pos.x, goal.z - pos.z);
  const r = 2.6 + Math.sin(t * 6) * 0.15;
  arrow.position.set(pos.x + Math.sin(a) * r, 0.25, pos.z + Math.cos(a) * r);
  arrow.rotation.y = a;
}

// ---------- Minimap (rotated so "up" matches the camera's forward) ----------
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const S = 300;
  const cx = place ? realm.x : 0;
  const cz = place ? realm.z : 0;
  const k = (S / 2 - 12) / (place ? realm.r + 3 : ISLAND_R);
  const to = (x, z) => [S / 2 + ((x - cx - (z - cz)) / Math.SQRT2) * k, S / 2 + ((x - cx + (z - cz)) / Math.SQRT2) * k];
  const dot = (x, z, r, color) => {
    const [sx, sy] = to(x, z);
    mm.fillStyle = color;
    mm.beginPath();
    mm.arc(sx, sy, r, 0, Math.PI * 2);
    mm.fill();
  };
  mm.clearRect(0, 0, S, S);
  if (place) {
    dot(cx, cz, (realm.r + 3) * k, place.ground);
    place.map.forEach((m) => dot(m.x, m.z, Math.max(3, m.r * k), m.color));
    return drawPlayerArrow(to);
  }
  dot(0, 0, ISLAND_R * k, '#9ad57a');
  dot(homeGate.spot.x, homeGate.spot.z, 6, '#2f6fe4');
  ZONES.forEach((z) => dot(z.x, z.z, z.r * k, visited.has(z.id) ? z.color : 'rgba(27,27,31,0.25)'));
  dot(ARENA.x, ARENA.z, ARENA.r * k, 'rgba(229,57,53,0.35)');
  dot(GROVE.x, GROVE.z, GROVE.r * k, 'rgba(255,143,177,0.6)');
  dot(FOREST.x, FOREST.z, FOREST.r * k, 'rgba(47,90,44,0.65)');
  SECRETS.forEach((sc) => found.has(sc.id) && dot(sc.x, sc.z, sc.r * k, 'rgba(124,77,255,0.45)')); // secrets appear once found
  world.orbs.forEach((o) => !o.taken && dot(o.x, o.z, 4, '#ffffff'));
  helpers.forEach((n) => dot(n.pos.x, n.pos.z, 5, `#${n.def.palette.body.toString(16).padStart(6, "0")}`));
  const pointer = games.pointer;
  if (pointer) dot(pointer.x, pointer.z, 7, '#ff4a1c');
  drawPlayerArrow(to);
}
function drawPlayerArrow(to) {
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

// ---------- Music: plays in the grove (and everywhere if switched on), with notes floating up ----------
const noteTex = textCanvas('♪', { w: 128, h: 128, bg: null, fg: '#d6457a', size: 96 });
const notes = Array.from({ length: 7 }, (_, i) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, opacity: 0, depthWrite: false }));
  s.scale.setScalar(1.3);
  s.userData = { a: (i / 7) * Math.PI * 2, life: i / 7 };
  scene.add(s);
  return s;
});
let inGrove = false;
let nowPlaying = null;
function updateMusic(dt) {
  const dGrove = Math.hypot(pos.x - GROVE.x, pos.z - GROVE.z);
  // Fade in over the last few metres before the grove so arriving feels gentle.
  const near = THREE.MathUtils.clamp(1 - (dGrove - GROVE.r) / 12, 0, 1);
  if (dGrove < GROVE.r && !inGrove && started) toast('Music Grove: stay a while');
  inGrove = dGrove < GROVE.r;
  // Which piece: the bench plays the sunset theme (or the nocturne after dark), the grove its waltz,
  // and "music everywhere" runs a time-of-day playlist.
  const night = nature.isNight;
  // Every other world has its own theme, which plays whenever sound is on there.
  const theme = place && { rome: 'forum', peaks: 'karakoram', coast: 'lagoon' }[place.id];
  const track = theme || (sitting ? (night ? 'nocturne' : 'sunset') : near > 0 && !place ? 'waltz' : 'auto');
  music.setTrack(track, night);
  if (music.track !== nowPlaying && music.level > 0.2) {
    nowPlaying = music.track;
    toast(`Now playing: ${SONG_NAMES[nowPlaying]}`);
  }
  music.setVolume(soundOn && started ? Math.max(place ? 0.5 : near, sitting ? 0.85 : 0, musicEverywhere ? 0.45 : 0) : 0);
  music.update(dt);
  notes.forEach((n) => {
    const u = n.userData;
    u.life = (u.life + dt * 0.25) % 1;
    n.position.set(GROVE.x - 4.5 + Math.sin(u.a + u.life * 4) * 1.2, 2 + u.life * 6, GROVE.z + 4 + Math.cos(u.a) * 0.8);
    n.material.opacity = music.level * Math.sin(u.life * Math.PI);
  });
}

// ---------- Guestbook and weather ----------
const BOARD = { def: { name: 'the guestbook' } };
const guestbook = createGuestbook({ scene, toast, onSigned: () => award('guest') });

// ---------- Sunset Point: sit on the bench for a quiet moment ----------
const SEAT = { def: { name: 'the bench' } };
const bench = createBench({ scene, addCollider: world.addCollider });
let sitting = false;
function sitDown() {
  sitting = true;
  target = null;
  route = [];
  marker.visible = false;
  keys.clear();
  pos.set(bench.seat.x, 0, bench.seat.z);
  bot.vel.set(0, 0, 0);
  heading = bench.seat.heading;
  bot.group.rotation.y = heading;
  bot.pose = 'sit';
  document.body.classList.add('cinematic');
  nature.setTimeScale(6); // a whole sunset in about a minute
  toast(nature.isNight ? 'Sunset Point: look up, shooting stars tonight' : 'Sunset Point: time drifts faster while you sit');
}
// ---------- Highland Forest: rare animals ----------
const forest = createForest({
  scene,
  addCollider: world.addCollider,
  getAudio,
  soundOn: () => soundOn && started,
  onEnter: () => toast(spotted.size < ANIMALS.length ? `${FOREST.name}: move quietly, rare animals live here (${spotted.size}/${ANIMALS.length} spotted)` : `${FOREST.name}: you have met every animal here`),
  onSpot: (def, at) => {
    const first = !spotted.has(def.id);
    spotted.add(def.id);
    store.set('animals', [...spotted]);
    toast(first ? `Rare sighting: ${def.name}!` : `The ${def.name} is here again`);
    blip(523, 1568, 0.5, 'sine', 0.1);
    if (spotted.size >= 3) award('naturalist');
    if (!lock) {
      openLocked(`animal:${def.id}:${Date.now()}`, {
        kicker: `Rare sighting // ${def.status}`,
        title: def.name,
        text: `${def.latin}\n\n${def.text}`,
        tags: [def.status, `${spotted.size} of ${ANIMALS.length} spotted`],
        actions: [{ label: 'Close', run: closePanel }],
      }, { x: at.x, z: at.z });
    }
  },
});

// ---------- Other worlds through the Sky Gate ----------
// Each is its own floating island far out in the sky, so only the one you're on is ever drawn.
const homeGate = makeGate(scene, GATE.x, GATE.z, Math.atan2(-GATE.x, -GATE.z), GATE.name);
homeGate.pillars.forEach((p) => world.addCollider(p.x, p.z, 0.9));
const worldCtx = (id) => ({ scene, origin: REALMS[id], addCollider: world.addCollider, getAudio, soundOn: () => soundOn && started });
const worlds = { rome: buildRome(worldCtx('rome')), peaks: buildPeaks(worldCtx('peaks')), coast: buildCoast(worldCtx('coast')) };
Object.values(worlds).forEach((w) => (w.group.visible = false));
const GATE_SPOT = { def: { name: 'the Sky Gate' } };
const SAGE = { def: { name: 'Diogenes' } };
let place = null; // the world we're visiting, or null at home
const visitedWorlds = new Set(store.get('worlds', []));
let snapAt = -1;
let batchAt = -1;
function openGateMenu() {
  const here = place ? place.id : 'home';
  openLocked(`gate:${Date.now()}`, {
    kicker: GATE.name,
    title: 'Where to?',
    text: Object.entries(REALMS).filter(([id]) => id !== here).map(([, r]) => `${r.name}: ${r.blurb}`).join('\n\n'),
    actions: [
      ...Object.entries(REALMS).filter(([id]) => id !== here).map(([id, r], i) => ({ label: r.name, primary: i === 0, run: () => travelTo(id) })),
      { label: 'Stay', run: closePanel },
    ],
  });
}
function travelTo(id) {
  closePanel();
  if (sitting) standUp();
  if (games.active) games.stop();
  $('travel').classList.add('show');
  blip(260, 1040, 0.9, 'sine', 0.08);
  setTimeout(() => {
    if (place) {
      place.group.visible = false;
      place.onLeave?.();
    }
    place = id === 'home' ? null : worlds[id];
    // A viewpoint's grade and camera push-in belong to that spot; travelling always clears them.
    if (artStyle) document.body.classList.remove(`style-${artStyle}`);
    art?.setStyle(null);
    artStyle = null;
    artPlace = null;
    const b = place ? place.bounds : { x: 0, z: 0, r: ISLAND_R - 2 };
    realm = { id, ...b };
    if (place) {
      place.group.visible = true;
      place.onEnter?.();
    }
    const sp = place ? place.spawn : homeGate.spot;
    pos.set(sp.x, 0, sp.z);
    bot.vel.set(0, 0, 0);
    target = null;
    route = [];
    marker.visible = false;
    heading = Math.atan2(b.x - sp.x, b.z - sp.z);
    bot.group.rotation.y = heading;
    const env = place ? place.env : { cloudSea: true, snow: 0 };
    sky.setCenter(b.x, b.z, b.r + 2, env.cloudSea);
    nature.handles.birds.setCenter(b.x, 0, b.z);
    weather.setIsland(b.x, b.z, b.r + 2, env.snow, id);
    frameCamera(0, true);
    // A newly shown world gets batched like the home island did.
    snapAt = frame + 5;
    batchAt = frame + 70;
    $('travel').classList.remove('show');
    if (id !== 'home') {
      visitedWorlds.add(id);
      store.set('worlds', [...visitedWorlds]);
      if (visitedWorlds.size === 3) award('traveller');
    }
    toast(id === 'home' ? 'Back home' : `Welcome to the ${REALMS[id].name}`);
  }, 650);
}
// Info spots, the resident animal, and walking away from a locked panel, for the other worlds.
const seenHere = new Set();
function discoverPlace() {
  if (lock && lock.x !== undefined && Math.hypot(pos.x - lock.x, pos.z - lock.z) > 9) closePanel();
  if (place.animal && place.animalVisible() && !seenHere.has(place.id) && Math.hypot(pos.x - place.animal.x, pos.z - place.animal.z) < 7.5) {
    seenHere.add(place.id);
    const def = place.animal.def;
    const first = !spotted.has(def.name);
    spotted.add(def.name);
    store.set('animals', [...spotted]);
    toast(first ? `Rare sighting: ${def.name}!` : `The ${def.name} is here again`);
    blip(523, 1568, 0.5, 'sine', 0.1);
    if (spotted.size >= 3) award('naturalist');
    openLocked(`animal:${def.name}:${Date.now()}`, { kicker: `Rare sighting // ${def.status}`, title: def.name, text: `${def.latin}\n\n${def.text}`, tags: [def.status], actions: [{ label: 'Close', run: closePanel }] }, { x: place.animal.x, z: place.animal.z });
    return;
  }
  if (lock) return;
  const spot = place.spots.find((s) => Math.hypot(pos.x - s.x, pos.z - s.z) < s.r);
  if (spot) showPanel(`spot:${spot.id}`, { kicker: spot.kicker, title: spot.title, text: spot.text });
  else if (panelKey?.startsWith('spot:')) hidePanel();
}

function standUp() {
  sitting = false;
  bot.pose = 'stand';
  bot.hold(null);
  if (view !== 'cinematic') document.body.classList.remove('cinematic');
  nature.setTimeScale(1);
}
$('guestbook-btn').onclick = () => guestbook.open();
// Created last, so every material in the world can get wet and snowy.
const weather = createWeather({
  scene, camera, renderer, nature, world, sun, hemi, islandR: ISLAND_R, touch, getAudio,
  soundOn: () => soundOn && started,
  noSnow: [bot.group, ...allBots.map((n) => n.bot.group), ...forest.movers], // moving things would slide through the snow pattern
});
const WX_NAMES = { clear: 'Clear sky', rain: 'Rain', snow: 'Snow', autumn: 'Autumn', dust: 'Sandstorm', blizzard: 'Blizzard' };
const WX_TOASTS = {
  clear: 'The sky is clearing up',
  rain: 'Clouds are gathering. Rain is coming',
  snow: 'It feels cold. Snow is on its way',
  autumn: 'Autumn is here. The trees are turning gold',
  dust: 'The wind is picking up sand. A sandstorm is coming',
  blizzard: 'The wind is howling. A blizzard is coming',
};
weather.onChange(({ mode, kind, reason }) => {
  $('weather').dataset.wx = kind;
  label('weather', mode === 'auto' ? 'Auto weather' : WX_NAMES[kind]);
  if (reason === 'mode') toast(mode === 'auto' ? 'Weather changes on its own' : WX_TOASTS[kind]);
  else if (started && reason !== 'travel') toast(WX_TOASTS[kind]);
});
$('weather').onclick = () => weather.cycle();

// Walking through a puddle splashes.
let splashClock = 0;
function splash(dt, speed01) {
  splashClock -= dt;
  if (speed01 < 0.3 || bot.y !== 0 || splashClock > 0 || !weather.puddleAt(pos.x, pos.z)) return;
  splashClock = 0.16;
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    spawn(new THREE.Vector3(pos.x, 0.2, pos.z), new THREE.Vector3(Math.cos(a) * 2.2, 2.5 + Math.random() * 2, Math.sin(a) * 2.2), i % 2 ? '#cfe8ff' : '#9cc9ee', 0.45);
  }
  blip(900, 300, 0.09, 'sine', 0.035);
}

// ---------- Loop ----------
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const lookGoal = new THREE.Vector3();
const clock = new THREE.Clock();
let frame = 0;

// Idle power saver: with no input for a while the scene is drawn at half rate.
let lastInput = performance.now();
['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, () => (lastInput = performance.now()), { passive: true }));

function resize() {
  const w = Math.max(1, innerWidth); // a hidden tab can report 0x0, which breaks the render targets
  const h = Math.max(1, innerHeight);
  const pr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer?.setPixelRatio(pr);
  composer?.setSize(w, h);
  art?.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  camera.aspect = w / h;
  // Phones in portrait get a wider field of view so the world still fits.
  camera.fov = w < h ? 55 : 40;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const VIEWS = ['follow', 'cinematic', 'birdseye'];
const VIEW_LABELS = { follow: 'Follow view', cinematic: 'Cinematic', birdseye: "Bird's-eye" };
let view = 'follow';
function cycleView() {
  view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
  document.body.classList.toggle('cinematic', view === 'cinematic');
  label('view', VIEW_LABELS[view]);
  toast(view === 'cinematic' ? 'Cinematic: the camera drifts around Byte. Press V to return.' : VIEW_LABELS[view]);
}
$('view').onclick = cycleView;

let moodIndex = 0; // 'cycle': the living day
function cycleMood() {
  moodIndex = (moodIndex + 1) % MOOD_ORDER.length;
  const name = MOOD_ORDER[moodIndex];
  nature.setMood(name);
  label('mood', name === 'cycle' ? nature.clockLabel : MOODS[name].label);
  $('mood').dataset.mood = name;
  toast(name === 'cycle' ? 'Day cycle: the sun and moon move on their own' : MOODS[name].label);
}
$('mood').onclick = cycleMood;
// The clock icon's hands follow the island's time.
const syncClock = () => {
  if (MOOD_ORDER[moodIndex] !== 'cycle') return;
  label('mood', nature.clockLabel);
  const h = nature.hours;
  $('mood').querySelector('.hand-h').style.transform = `rotate(${(h % 12) * 30}deg)`;
  $('mood').querySelector('.hand-m').style.transform = `rotate(${(h % 1) * 360 - 90}deg)`;
};
syncClock();

let musicEverywhere = store.get('music', false);
const syncMusic = () => {
  label('music', musicEverywhere ? 'Music on' : 'Music');
  $('music').setAttribute('aria-pressed', String(musicEverywhere));
};
$('music').onclick = () => {
  musicEverywhere = !musicEverywhere;
  store.set('music', musicEverywhere);
  syncMusic();
  getAudio().resume?.();
};
syncMusic();

const moment = new THREE.Vector3();
function frameCamera(dt, snap) {
  if (sitting) {
    // Low, over Byte's shoulder, looking out across the clouds (and up a little at night).
    const f = bench.facing;
    camPos.set(pos.x - f.x * 11 - f.z * 3.4, 5.4, pos.z - f.z * 11 + f.x * 3.4);
    camera.position.lerp(camPos, Math.min(1, dt * 2));
    lookAt.lerp(moment.set(pos.x + f.x * 40, nature.isNight ? 14 : 0, pos.z + f.z * 40), Math.min(1, dt * 2));
    camera.lookAt(lookAt);
    sun.position.set(pos.x + nature.sunOffset.x, nature.sunOffset.y, pos.z + nature.sunOffset.z);
    sun.target.position.set(pos.x, 0, pos.z);
    return;
  }
  if (view === 'cinematic') {
    // Slow orbit at a low angle: the "film" view for enjoying the mood (dragging still steers it).
    camYaw += dt * 0.12;
    updateCamAxes();
    camPos.set(pos.x + Math.sin(camYaw) * 24 * zoom, 7 + 4 * zoom, pos.z + Math.cos(camYaw) * 24 * zoom);
  } else if (view === 'birdseye') {
    camPos.set(pos.x + Math.sin(camYaw) * 8 * zoom, 75 * zoom, pos.z + Math.cos(camYaw) * 8 * zoom);
  } else {
    // Arriving at a secret place, the camera slowly pushes in and drops to a lower, filmic angle
    // with a narrower lens, so the place fills the frame around Byte.
    camPos.copy(pos).addScaledVector(camDir, 40 * zoom * (1 - 0.4 * focus));
    camPos.y -= 7 * focus * zoom;
  }
  focus += ((artPlace && view === 'follow' ? 1 : 0) - focus) * Math.min(1, dt * 0.9);
  const fov = (innerWidth < innerHeight ? 55 : 40) - 6 * focus;
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  if (snap) camera.position.copy(camPos);
  else camera.position.lerp(camPos, Math.min(1, dt * 4));
  lookGoal.set(pos.x, 1.5 + focus * 1.2, pos.z);
  lookAt.lerp(lookGoal, snap ? 1 : Math.min(1, dt * 6));
  camera.lookAt(lookAt);
  sun.position.set(pos.x + nature.sunOffset.x, nature.sunOffset.y, pos.z + nature.sunOffset.z);
  sun.target.position.set(pos.x, 0, pos.z);
}
lookAt.set(pos.x, 1.5, pos.z);
frameCamera(0, true);

function updateBots(dt, t) {
  nearby = null;
  if (place) {
    if (Math.hypot(pos.x - place.gate.x, pos.z - place.gate.z) < 4) nearby = GATE_SPOT;
    else if (place.npc && Math.hypot(pos.x - place.npc.x, pos.z - place.npc.z) < 4.5) nearby = SAGE;
    return showPrompt();
  }
  let closest = 3.8;
  helpers.forEach((n) => {
    const d = n.update(dt, t, pos, collide, world.randomSpot);
    if (d < closest && !n.lead) {
      closest = d;
      nearby = n;
    }
  });
  drones.forEach((n) => {
    const d = n.update(dt, t, pos, collide, world.randomSpot);
    // A new fact each time you walk up to a drone.
    if (d > 12) n.readyForNext = true;
    if (d < 9 && n.readyForNext) {
      n.readyForNext = false;
      n.factIndex += 1;
      n.say(FACTS[n.factIndex % FACTS.length]);
    }
  });
  if (!nearby && Math.hypot(pos.x - guestbook.spot.x, pos.z - guestbook.spot.z) < 4.2) nearby = BOARD;
  if (!nearby && !sitting && Math.hypot(pos.x - bench.spot.x, pos.z - bench.spot.z) < 3.6) nearby = SEAT;
  if (!nearby && Math.hypot(pos.x - homeGate.spot.x, pos.z - homeGate.spot.z) < 4) nearby = GATE_SPOT;
  if (sitting) nearby = null;
  showPrompt();
}
function showPrompt() {
  const show = started && nearby && !games.active;
  $('prompt').classList.toggle('show', Boolean(show));
  if (show) {
    const what = nearby === BOARD ? 'sign the guestbook' : nearby === SEAT ? 'sit on the bench' : nearby === GATE_SPOT ? 'travel through the Sky Gate' : `talk to ${nearby.def.name}`;
    $('prompt').textContent = touch ? what[0].toUpperCase() + what.slice(1) : `Press E to ${what}`;
  }
}

let batched = false;
// Anything that moves, animates or gets hidden later must never be merged into static scenery,
// even if it happened to stand still while the snapshot was taken (an idle helper bot, a rare animal).
const batchExclude = () => [bot.group, marker, arrow, ...allBots.map((n) => n.bot.group), ...forest.movers, ...world.orbs.map((o) => o.group), ...Object.values(worlds).flatMap((w) => w.movers ?? [])];
// Animated rigs keep every part separate: a limb that happened to be idle during the snapshot would
// otherwise be merged and freeze when the animation later moves the original.
const rigSkip = () => {
  const set = new Set();
  batchExclude().forEach((r) => r?.traverse?.((o) => set.add(o)));
  return set;
};
let before = null;
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  // Idle and nothing cinematic going on: skip every other frame (30 fps) to save power.
  const idle = now - lastInput > 15000 && !sitting && view !== 'cinematic' && !games.active;
  if (idle && frame % 2 === 1) {
    frame++;
    return;
  }
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;
  SWAY_TIME.value = t;
  // Static batching, once: snapshot every mesh, let a second of animation play, then merge
  // whatever never moved.
  if (frame === 5 || frame === snapAt) before = snapshot(scene);
  if (frame === batchAt && before) {
    const res = batchStatic(scene, before, { exclude: batchExclude() });
    compactRigs(scene, before, { skip: rigSkip() });
    before = null;
    if (import.meta.env.DEV) console.info(`[perf] ${realm.id}: batched ${res.removed} static meshes into ${res.merged}`);
  }
  if (frame === 70 && !batched) {
    batched = true;
    const res = batchStatic(scene, before, { exclude: batchExclude() });
    const rigs = compactRigs(scene, before, { skip: rigSkip() });
    before = null;
    if (import.meta.env.DEV) console.info(`[perf] batched ${res.removed} static meshes into ${res.merged}; compacted ${rigs.removed} rig parts into ${rigs.added}`);
  }
  const home = !place;
  if (home) world.update(t, dt);
  const speed01 = started ? step(dt) : 0;
  bot.animate(dt, t, speed01, heading);
  updateBots(dt, t);
  if (started) {
    if (home) discover();
    else discoverPlace();
    games.update(dt, t);
  }
  if (home) updateArrow(t);
  else arrow.visible = false;
  nature.update(dt, t, pos);
  sky.update(dt, t, pos);
  if (place) {
    scene.fog.near *= place.env.fog;
    scene.fog.far *= place.env.fog;
  }
  if (sitting) {
    // Clearer air on the bench, so the view carries all the way to the horizon.
    scene.fog.near *= 1.8;
    scene.fog.far *= 2.2;
    nature.handles.mistMat.opacity *= 0.1; // ground mist would sit right between the camera and the view
  }
  weather.update(dt, t, pos, heading, started && speed01 > 0.3 && bot.y === 0);
  if (home && started) splash(dt, speed01);
  if (home) secrets.update(dt, t, pos, speed01, nature.wind);
  updateMusic(dt, t);
  updateParticles(dt, speed01);
  if (marker.visible) marker.scale.setScalar(THREE.MathUtils.lerp(marker.scale.x, 1, dt * 8));
  frameCamera(dt, false);
  if (++frame % 3 === 0) drawMinimap();
  if (frame % 20 === 0) syncClock();
  art?.update(dt, t);
  if (sitting) {
    const reading = !nature.isNight;
    if (reading !== (bot.arms[1].hand.children[0] === bench.book)) bot.hold(reading ? bench.book : null);
    bot.lookUp += ((reading ? 0 : 1) - bot.lookUp) * Math.min(1, dt * 1.5);
  } else bot.lookUp += (0 - bot.lookUp) * Math.min(1, dt * 3);
  if (home) {
    bench.update(dt, t, { sitting, night: nature.isNight, reading: sitting && !nature.isNight, camera });
    forest.update(dt, t, pos, nature.isNight, camera.position);
  } else place.update(dt, t, pos, nature.isNight, true);
  tickGates(t);
  if (composer) composer.render();
  else renderer.render(scene, camera);
}
tick();

// ---------- Badges list ----------
$('badges').onclick = () =>
  openLocked(`badges:${Date.now()}`, {
    kicker: `${badges.size} of ${BADGES.length} unlocked`,
    title: 'Badges',
    text: BADGES.map(([id, name, how]) => `${badges.has(id) ? '[x]' : '[ ]'} ${name}: ${how}`).join('\n') + `\n\nSecret places found: ${found.size} of ${SECRETS.length}\nRare animals spotted: ${spotted.size} of ${ANIMALS.length}` + (spotted.size ? ` (${ANIMALS.filter((a) => spotted.has(a.id)).map((a) => a.name).join(', ')})` : ''),
    actions: [{ label: 'Close', run: closePanel }],
  });

// ---------- Start ----------
// Compile every shader now, while the intro is up (hidden animals, rain and snow included), so walking
// into new places never stalls a frame. With post-processing the scene renders into the composer's
// target, which uses different shader variants, so compile against that.
if (composer) renderer.setRenderTarget(composer.readBuffer);
renderer.compile(scene, camera);
renderer.setRenderTarget(null);
$('start').disabled = false;
$('start').textContent = taken.size || visited.size ? 'Continue exploring' : 'Start exploring';
const start = () => {
  started = true;
  document.activeElement?.blur(); // otherwise the hidden button keeps focus and swallows WASD
  $('intro').classList.add('hidden');
  blip(330, 660, 0.25, 'sine', 0.08);
  setTimeout(() => ($('hint').style.opacity = '0'), 10000);
};
$('start').onclick = start;
if (import.meta.env.DEV) window.__sw = { go: (x, z) => { route = nav.path(pos, { x, z }, realm, BOT_R + 0.1) || []; target = route.shift() ?? null; return route.length + (target ? 1 : 0); }, travel: (id) => travelTo(id), place: () => place?.id ?? "home", music, pos, start, world, helpers, games, weather, nature, sky, camera, bot, forest, renderer, scene, art: () => art, cam: (y, p, z = zoom) => ((camYaw = y), (camPitch = p), (zoom = z), updateCamAxes()) }; // dev-only hook for testing; stripped from builds
$('keep-playing').onclick = () => $('finale').classList.add('hidden');
// Repeat visits load from the local cache (see public/sw.js). Off in dev so hot reload stays honest.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
if (touch) $('hint').textContent = 'Tap the ground to walk, drag to look around, pinch to zoom.';
