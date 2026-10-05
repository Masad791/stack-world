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
import { ZONES, CONTACT, PORTFOLIO, HELPERS, FACTS, BADGES, ARENA, GROVE, SECRETS } from './data.js';

// 3D labels are drawn onto canvases once, so wait (briefly) for the brand font first.
await Promise.race([document.fonts?.load('600 54px "Space Grotesk"'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

const $ = (id) => document.getElementById(id);
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

// Bloom makes lamps, lanterns, fireflies and the bots' eyes glow. Skipped on touch devices to save their GPUs.
let composer = null;
let bloom = null;
if (!touch) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.6, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
const secrets = createSecrets({ scene, addCollider: world.addCollider });
const nature = createNature({ scene, hemi, sun, renderer, bloom, sea: world.sea, islandTop: world.islandTop, islandR: ISLAND_R, addCollider: world.addCollider });
const bot = new Bot();
bot.group.position.set(0, 0, 9);
bot.group.scale.setScalar(1.35);
bot.group.rotation.y = Math.PI;
scene.add(bot.group);
const pos = bot.group.position;

// Push a point out of every building, tree and prop, and keep it on the island.
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
  const fromCenter = Math.hypot(p.x, p.z);
  if (fromCenter > ISLAND_R - 2) p.multiplyScalar((ISLAND_R - 2) / fromCenter);
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
  const npc = new NPC({ name: `Drone ${i + 1}`, home: [spot.x, spot.z], roamAll: true, scale: 0.75, speed: 5, shell: 0xffffff, accent: [0x61dafb, 0x41b883, 0xffd166][i] }, scene);
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
const talked = new Set(store.get('talked', []));
const badges = new Set(store.get('badges', []));
const found = new Set(store.get('secrets', []));
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
  $('compass').textContent = compassOn ? 'Compass on' : 'Compass';
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
let target = null; // click-to-walk destination
let zoom = 1;
let nearby = null; // helper bot within talking range
const setZoom = (z) => (zoom = THREE.MathUtils.clamp(z, 0.6, 1.5));

addEventListener('keydown', (e) => {
  if (!started || e.target.closest?.('a, button')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'e' && nearby) return talk(nearby);
  if (k === 'escape') return closePanel();
  if (k === 'm') return cycleMood();
  if (k === 'v') return cycleView();
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
$('prompt').onclick = () => nearby && talk(nearby);

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
function discover() {
  // Secret places: discovery, plus each one's own art style while you're inside.
  const secret = secrets.at(pos);
  const style = secret ? secret.style : null;
  if (style !== artStyle) {
    if (artStyle) document.body.classList.remove(`style-${artStyle}`);
    if (style) document.body.classList.add(`style-${style}`);
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
  const k = (S / 2 - 12) / ISLAND_R;
  const to = (x, z) => [S / 2 + ((x - z) / Math.SQRT2) * k, S / 2 + ((x + z) / Math.SQRT2) * k];
  const dot = (x, z, r, color) => {
    const [sx, sy] = to(x, z);
    mm.fillStyle = color;
    mm.beginPath();
    mm.arc(sx, sy, r, 0, Math.PI * 2);
    mm.fill();
  };
  mm.clearRect(0, 0, S, S);
  dot(0, 0, ISLAND_R * k, '#9ad57a');
  ZONES.forEach((z) => dot(z.x, z.z, z.r * k, visited.has(z.id) ? z.color : 'rgba(27,27,31,0.25)'));
  dot(ARENA.x, ARENA.z, ARENA.r * k, 'rgba(229,57,53,0.35)');
  dot(GROVE.x, GROVE.z, GROVE.r * k, 'rgba(255,143,177,0.6)');
  SECRETS.forEach((sc) => found.has(sc.id) && dot(sc.x, sc.z, sc.r * k, 'rgba(124,77,255,0.45)')); // secrets appear once found
  world.orbs.forEach((o) => !o.taken && dot(o.x, o.z, 4, '#ffffff'));
  helpers.forEach((n) => dot(n.pos.x, n.pos.z, 5, `#${n.def.shell.toString(16).padStart(6, '0')}`));
  const pointer = games.pointer;
  if (pointer) dot(pointer.x, pointer.z, 7, '#ff4a1c');
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
function updateMusic(dt) {
  const dGrove = Math.hypot(pos.x - GROVE.x, pos.z - GROVE.z);
  // Fade in over the last few metres before the grove so arriving feels gentle.
  const near = THREE.MathUtils.clamp(1 - (dGrove - GROVE.r) / 12, 0, 1);
  if (dGrove < GROVE.r && !inGrove && started) toast('Music Grove: stay a while');
  inGrove = dGrove < GROVE.r;
  music.setVolume(soundOn && started ? Math.max(near, musicEverywhere ? 0.45 : 0) : 0);
  music.update(dt);
  notes.forEach((n) => {
    const u = n.userData;
    u.life = (u.life + dt * 0.25) % 1;
    n.position.set(GROVE.x - 4.5 + Math.sin(u.a + u.life * 4) * 1.2, 2 + u.life * 6, GROVE.z + 4 + Math.cos(u.a) * 0.8);
    n.material.opacity = music.level * Math.sin(u.life * Math.PI);
  });
}

// ---------- Loop ----------
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const lookGoal = new THREE.Vector3();
const clock = new THREE.Clock();
let frame = 0;

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // can change when the window moves between screens
  renderer.setSize(w, h, false);
  composer?.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer?.setSize(w, h);
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
let orbit = Math.PI / 4;
function cycleView() {
  view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
  document.body.classList.toggle('cinematic', view === 'cinematic');
  $('view').textContent = VIEW_LABELS[view];
  toast(view === 'cinematic' ? 'Cinematic: the camera drifts around Byte. Press V to return.' : VIEW_LABELS[view]);
}
$('view').onclick = cycleView;

let moodIndex = 0;
function cycleMood() {
  moodIndex = (moodIndex + 1) % MOOD_ORDER.length;
  const name = MOOD_ORDER[moodIndex];
  nature.setMood(name);
  $('mood').textContent = MOODS[name].label;
  toast(MOODS[name].label);
}
$('mood').onclick = cycleMood;

let musicEverywhere = store.get('music', false);
const syncMusic = () => {
  $('music').textContent = musicEverywhere ? 'Music on' : 'Music';
  $('music').setAttribute('aria-pressed', String(musicEverywhere));
};
$('music').onclick = () => {
  musicEverywhere = !musicEverywhere;
  store.set('music', musicEverywhere);
  syncMusic();
  getAudio().resume?.();
};
syncMusic();

function frameCamera(dt, snap) {
  if (view === 'cinematic') {
    // Slow orbit at a low angle: the "film" view for enjoying the mood.
    orbit += dt * 0.12;
    camPos.set(pos.x + Math.sin(orbit) * 24 * zoom, 7 + 4 * zoom, pos.z + Math.cos(orbit) * 24 * zoom);
  } else if (view === 'birdseye') {
    camPos.set(pos.x + 8 * zoom, 75 * zoom, pos.z + 8 * zoom);
  } else {
    camPos.copy(pos).addScaledVector(CAM_DIR, 40 * zoom);
  }
  if (snap) camera.position.copy(camPos);
  else camera.position.lerp(camPos, Math.min(1, dt * 4));
  lookAt.lerp(lookGoal.set(pos.x, 1.5, pos.z), snap ? 1 : Math.min(1, dt * 6));
  camera.lookAt(lookAt);
  sun.position.set(pos.x + nature.sunOffset.x, nature.sunOffset.y, pos.z + nature.sunOffset.z);
  sun.target.position.set(pos.x, 0, pos.z);
}
lookAt.set(pos.x, 1.5, pos.z);
frameCamera(0, true);

function updateBots(dt, t) {
  nearby = null;
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
  const show = started && nearby && !games.active;
  $('prompt').classList.toggle('show', Boolean(show));
  if (show) $('prompt').textContent = touch ? `Talk to ${nearby.def.name}` : `Press E to talk to ${nearby.def.name}`;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;
  world.update(t, dt);
  const speed01 = started ? step(dt) : 0;
  bot.animate(dt, t, speed01, heading);
  updateBots(dt, t);
  if (started) {
    discover();
    games.update(dt, t);
  }
  updateArrow(t);
  nature.update(dt, t, pos);
  secrets.update(dt, t, pos, speed01, nature.wind);
  updateMusic(dt, t);
  updateParticles(dt, speed01);
  if (marker.visible) marker.scale.setScalar(THREE.MathUtils.lerp(marker.scale.x, 1, dt * 8));
  frameCamera(dt, false);
  if (++frame % 3 === 0) drawMinimap();
  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// ---------- Badges list ----------
$('badges').onclick = () =>
  openLocked(`badges:${Date.now()}`, {
    kicker: `${badges.size} of ${BADGES.length} unlocked`,
    title: 'Badges',
    text: BADGES.map(([id, name, how]) => `${badges.has(id) ? '[x]' : '[ ]'} ${name}: ${how}`).join('\n') + `\n\nSecret places found: ${found.size} of ${SECRETS.length}`,
    actions: [{ label: 'Close', run: closePanel }],
  });

// ---------- Start ----------
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
if (import.meta.env.DEV) window.__sw = { pos, start, world, helpers, games }; // dev-only hook for testing; stripped from builds
$('keep-playing').onclick = () => $('finale').classList.add('hidden');
if (touch) $('hint').textContent = 'Tap the ground to walk. Tap "Talk" near a helper bot to chat or play.';
