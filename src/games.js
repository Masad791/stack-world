import * as THREE from 'three';
import { ARENA, RINGS, RACE_PAR, QUIZ } from './data.js';

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

// A beetle: red shell with spots, black head, wiggling legs.
function makeBug() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshStandardMaterial({ color: '#e53935', roughness: 0.4 }));
  shell.scale.set(1, 0.6, 1.25);
  shell.position.y = 0.35;
  shell.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshStandardMaterial({ color: '#1b1b1f' }));
  head.position.set(0, 0.32, 0.72);
  const dot = new THREE.MeshStandardMaterial({ color: '#1b1b1f' });
  [[-0.22, 0.1], [0.22, 0.1], [0, -0.3]].forEach(([x, z]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dot);
    s.position.set(x, 0.66, z);
    g.add(s);
  });
  const legs = [];
  [-1, 1].forEach((side) => [-0.35, 0, 0.35].forEach((z) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), dot);
    leg.position.set(side * 0.55, 0.15, z);
    g.add(leg);
    legs.push(leg);
  }));
  g.add(shell, head);
  return { group: g, legs, heading: Math.random() * 6, target: null };
}

// ctx: { scene, player (Vector3), ui: { bar, clearBar, toast, blip, burst, panel }, award, store }
export function createGames(ctx) {
  const { scene, player, ui } = ctx;
  let active = null; // 'bugs' | 'race' | 'quiz'
  const state = {};

  // ---------- Bug Squash ----------
  const arenaRing = new THREE.Mesh(new THREE.TorusGeometry(ARENA.r, 0.18, 8, 64), new THREE.MeshBasicMaterial({ color: '#e53935' }));
  arenaRing.rotation.x = Math.PI / 2;
  arenaRing.position.set(ARENA.x, 0.15, ARENA.z);
  arenaRing.visible = false;
  scene.add(arenaRing);

  function startBugs() {
    Object.assign(state, { time: 30, score: 0, bugs: [] });
    arenaRing.visible = true;
  }
  function spawnBug() {
    const b = makeBug();
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (ARENA.r - 1.5);
    b.group.position.set(ARENA.x + Math.cos(a) * r, 0, ARENA.z + Math.sin(a) * r);
    scene.add(b.group);
    state.bugs.push(b);
  }
  function updateBugs(dt, t) {
    state.time -= dt;
    while (state.bugs.length < 7) spawnBug();
    arenaRing.material.color.setHSL(0, 0.8, 0.5 + Math.sin(t * 6) * 0.1);
    for (const b of [...state.bugs]) {
      const p = b.group.position;
      const away = new THREE.Vector3(p.x - player.x, 0, p.z - player.z);
      const near = away.length();
      if (near < 1.7) {
        // Squashed!
        state.score += 1;
        ui.burst(p, ['#e53935', '#1b1b1f', '#ffd166']);
        ui.blip(500, 120, 0.15, 'square', 0.06);
        scene.remove(b.group);
        state.bugs.splice(state.bugs.indexOf(b), 1);
        continue;
      }
      let dir;
      if (near < 5) dir = away.normalize(); // flee
      else {
        if (!b.target || Math.hypot(b.target.x - p.x, b.target.z - p.z) < 0.5) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * (ARENA.r - 1);
          b.target = { x: ARENA.x + Math.cos(a) * r, z: ARENA.z + Math.sin(a) * r };
        }
        dir = new THREE.Vector3(b.target.x - p.x, 0, b.target.z - p.z).normalize();
      }
      const speed = near < 5 ? 5.2 : 2.6;
      p.addScaledVector(dir, speed * dt);
      // Stay inside the arena.
      const dx = p.x - ARENA.x;
      const dz = p.z - ARENA.z;
      const d = Math.hypot(dx, dz);
      if (d > ARENA.r - 0.8) {
        p.x = ARENA.x + (dx / d) * (ARENA.r - 0.8);
        p.z = ARENA.z + (dz / d) * (ARENA.r - 0.8);
        b.target = null;
      }
      const want = Math.atan2(dir.x, dir.z);
      b.heading += Math.atan2(Math.sin(want - b.heading), Math.cos(want - b.heading)) * Math.min(1, dt * 10);
      b.group.rotation.y = b.heading;
      b.legs.forEach((l, i) => (l.rotation.y = Math.sin(t * 30 + i) * 0.4));
    }
    ui.bar(`Bug Squash // ${state.score} squashed // ${Math.ceil(state.time)}s`);
    if (state.time <= 0) {
      const best = Math.max(ctx.store.get('best:bugs', 0), state.score);
      ctx.store.set('best:bugs', best);
      state.bugs.forEach((b) => scene.remove(b.group));
      arenaRing.visible = false;
      if (state.score >= 15) ctx.award('debugger');
      finish('Bug Squash', `You squashed ${state.score} bugs. Best: ${best}.`, 'bugs');
    }
  }

  // ---------- Deploy Race ----------
  const ringMeshes = RINGS.map(([x, z], i) => {
    const [px, pz] = i ? RINGS[i - 1] : [-24, 22];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.28, 10, 40), new THREE.MeshStandardMaterial({ color: '#ff4a1c', emissive: '#ff4a1c', emissiveIntensity: 1 }));
    ring.position.set(x, 2.6, z);
    ring.rotation.y = Math.atan2(x - px, z - pz); // face the direction you arrive from
    ring.visible = false;
    scene.add(ring);
    return ring;
  });
  function startRace() {
    Object.assign(state, { idx: 0, time: 0 });
    ringMeshes.forEach((r) => (r.visible = true));
  }
  function updateRace(dt, t) {
    state.time += dt;
    ringMeshes.forEach((r, i) => {
      r.visible = i >= state.idx;
      const current = i === state.idx;
      r.material.emissiveIntensity = current ? 1.6 + Math.sin(t * 8) * 0.6 : 0.2;
      r.scale.setScalar(current ? 1 + Math.sin(t * 8) * 0.06 : 0.8);
    });
    const [x, z] = RINGS[state.idx];
    if (Math.hypot(player.x - x, player.z - z) < 2.6) {
      ui.burst(ringMeshes[state.idx].position, ['#ff4a1c', '#ffd166', '#ffffff']);
      ui.blip(520 + state.idx * 60, 1040 + state.idx * 60, 0.15);
      state.idx += 1;
      if (state.idx === RINGS.length) {
        const time = state.time;
        const best = Math.min(ctx.store.get('best:race', Infinity) ?? Infinity, time);
        ctx.store.set('best:race', best);
        ringMeshes.forEach((r) => (r.visible = false));
        if (time < RACE_PAR) ctx.award('speedrunner');
        finish('Deploy Race', `Shipped in ${time.toFixed(1)} s. Best: ${best.toFixed(1)} s. Par is ${RACE_PAR} s.`, 'race');
        return;
      }
    }
    ui.bar(`Deploy Race // ring ${state.idx + 1}/${RINGS.length} // ${state.time.toFixed(1)}s`);
  }

  // ---------- Stack Quiz (lives entirely in the panel) ----------
  function startQuiz() {
    Object.assign(state, { questions: shuffle(QUIZ).slice(0, 5), q: 0, score: 0 });
    ask();
  }
  function ask() {
    const [question, right, ...wrong] = state.questions[state.q];
    ui.bar(`Stack Quiz // question ${state.q + 1}/5 // ${state.score} correct`);
    ui.panel('quiz', {
      kicker: `Question ${state.q + 1} of 5`,
      title: question,
      text: 'Pick one.',
      actions: shuffle([right, ...wrong]).map((option) => ({
        label: option,
        run: () => answer(option === right, right),
      })),
    });
  }
  function answer(correct, right) {
    if (correct) {
      state.score += 1;
      ui.toast('Correct!');
      ui.blip(660, 990, 0.18);
    } else {
      ui.toast(`It was: ${right}`);
      ui.blip(300, 150, 0.25, 'sawtooth', 0.05);
    }
    state.q += 1;
    if (state.q < 5) return ask();
    const best = Math.max(ctx.store.get('best:quiz', 0), state.score);
    ctx.store.set('best:quiz', best);
    if (state.score === 5) ctx.award('quiz');
    finish('Stack Quiz', `You got ${state.score} of 5. Best: ${best} of 5.`, 'quiz');
  }

  // ---------- Shared ----------
  function finish(title, text, id) {
    active = null;
    ui.clearBar();
    ui.panel(`result:${id}:${Date.now()}`, {
      kicker: 'Game over',
      title,
      text,
      actions: [
        { label: 'Play again', primary: true, run: () => start(id) },
        { label: 'Done', run: () => ui.closePanel() },
      ],
    });
  }

  function start(id) {
    if (active) stop();
    active = id;
    ui.closePanel();
    ({ bugs: startBugs, race: startRace, quiz: startQuiz })[id]();
    ui.toast({ bugs: 'Squash the bugs!', race: 'Go! Hit the glowing ring', quiz: 'Quiz time' }[id]);
  }

  function stop() {
    if (active === 'bugs') {
      state.bugs.forEach((b) => scene.remove(b.group));
      arenaRing.visible = false;
    }
    if (active === 'race') ringMeshes.forEach((r) => (r.visible = false));
    if (active === 'quiz') ui.closePanel();
    active = null;
    ui.clearBar();
  }

  return {
    start,
    stop,
    get active() {
      return active;
    },
    // Where the compass should point during a game (null = default behaviour).
    get pointer() {
      if (active === 'race') return { x: RINGS[state.idx][0], z: RINGS[state.idx][1] };
      if (active === 'bugs' && Math.hypot(player.x - ARENA.x, player.z - ARENA.z) > ARENA.r) return ARENA;
      return null;
    },
    update(dt, t) {
      if (active === 'bugs') updateBugs(dt, t);
      else if (active === 'race') updateRace(dt, t);
    },
  };
}
