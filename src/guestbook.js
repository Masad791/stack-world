import * as THREE from 'three';
import { GUESTBOOK } from './data.js';
import { textCanvas } from './world.js';

// The guestbook: a notice board near the plaza with the latest notes pinned to it, and a dialog to
// read them all and pin your own. Notes come from the Netlify Function at /api/guestbook.
const API = '/api/guestbook';
const PAPER = ['#fff4b8', '#ffd6e0', '#d6f0ff', '#dff5d0', '#ffe2c4'];
const paperFor = (name) => PAPER[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PAPER.length];
const tiltFor = (ts) => ((ts % 7) - 3) * 0.9;
const ago = (ts) => {
  const s = (Date.now() - ts) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (s < 60) return 'just now';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
};

export function createGuestbook({ scene, toast, onSigned }) {
  const $ = (id) => document.getElementById(id);

  // ---------- The board ----------
  const wood = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#b5533c', roughness: 0.8, flatShading: true });
  const board = new THREE.Group();
  board.position.set(GUESTBOOK.x, 0, GUESTBOOK.z);
  board.rotation.y = Math.PI / 4; // faces the camera, like the billboards
  const part = (geo, material, x, y, z) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    board.add(mesh);
    return mesh;
  };
  [-1.75, 1.75].forEach((x) => part(new THREE.BoxGeometry(0.22, 3.6, 0.22), wood, x, 1.8, 0));
  part(new THREE.BoxGeometry(3.9, 2.6, 0.16), wood, 0, 2.35, 0);
  [-1, 1].forEach((side) => {
    const roof = part(new THREE.BoxGeometry(2.3, 0.12, 0.8), roofMat, side * 1.02, 3.95, 0);
    roof.rotation.z = -side * 0.42;
  });
  const cork = document.createElement('canvas');
  cork.width = 512;
  cork.height = 336;
  const corkTex = new THREE.CanvasTexture(cork);
  corkTex.colorSpace = THREE.SRGBColorSpace;
  corkTex.anisotropy = 4;
  part(new THREE.PlaneGeometry(3.6, 2.36), new THREE.MeshStandardMaterial({ map: corkTex, roughness: 1 }), 0, 2.35, 0.09).castShadow = false;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas('Guestbook', { fg: '#b5533c' }), depthWrite: false }));
  sign.scale.set(6, 1.5, 1);
  sign.position.set(0, 6, 0);
  board.add(sign);
  scene.add(board);

  // Pin the newest notes onto the cork, so the board in the world shows real messages.
  const drawBoard = (entries) => {
    const g = cork.getContext('2d');
    g.fillStyle = '#c89a64';
    g.fillRect(0, 0, cork.width, cork.height);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(90, 55, 25, ${Math.random() * 0.18})`;
      g.fillRect(Math.random() * cork.width, Math.random() * cork.height, 2, 2);
    }
    const notes = entries.length ? entries.slice(0, 8) : [{ name: 'Byte', message: 'Be the first to pin a note!', ts: 3 }];
    notes.forEach((n, i) => {
      const x = 18 + (i % 4) * 123;
      const y = 16 + Math.floor(i / 4) * 160;
      g.save();
      g.translate(x + 54, y + 70);
      g.rotate((tiltFor(n.ts) * Math.PI) / 180);
      g.fillStyle = 'rgba(0, 0, 0, 0.18)';
      g.fillRect(-50, -64, 108, 138);
      g.fillStyle = paperFor(n.name);
      g.fillRect(-54, -70, 108, 138);
      g.fillStyle = '#e3342f';
      g.beginPath();
      g.arc(0, -60, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1b1b1f';
      g.font = '700 17px "Space Grotesk", sans-serif';
      g.fillText(n.name.slice(0, 11), -44, -32);
      g.font = '500 14px "Space Grotesk", sans-serif';
      // Word wrap the message into the note.
      const words = n.message.split(' ');
      let line = '';
      let ly = -10;
      for (const w of words) {
        if (g.measureText(`${line} ${w}`).width > 88 && line) {
          g.fillText(line, -44, ly);
          line = w;
          if ((ly += 18) > 52) break;
        } else line = line ? `${line} ${w}` : w;
      }
      if (ly <= 52) g.fillText(line, -44, ly);
      g.restore();
    });
    corkTex.needsUpdate = true;
  };

  // ---------- Dialog ----------
  const dialog = $('guestbook');
  const form = $('gb-form');
  const field = form.elements; // not form.name: that's the form's own name attribute
  const list = $('gb-list');
  const status = $('gb-status');
  let entries = [];
  const render = () => {
    list.replaceChildren(
      ...entries.map((n, i) => {
        const li = document.createElement('li');
        li.className = 'gb-note';
        li.style.setProperty('--paper', paperFor(n.name));
        li.style.setProperty('--tilt', `${tiltFor(n.ts)}deg`);
        li.style.setProperty('--i', i);
        const name = document.createElement('strong');
        name.textContent = n.name;
        const msg = document.createElement('p');
        msg.textContent = n.message;
        const when = document.createElement('time');
        when.dateTime = new Date(n.ts).toISOString();
        when.textContent = ago(n.ts);
        li.append(name, msg, when);
        return li;
      })
    );
    if (!entries.length) list.innerHTML = '<li class="gb-empty">No notes yet. Be the first!</li>';
  };
  const load = async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error();
      entries = (await res.json()).entries;
      status.textContent = '';
    } catch {
      status.textContent = 'The guestbook is resting right now. Try again in a bit.';
    }
    render();
    drawBoard(entries);
  };

  field.message.addEventListener('input', () => ($('gb-count').textContent = `${field.message.value.length}/200`));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = field.name.value.trim();
    const message = field.message.value.trim();
    if (!name || message.length < 2) {
      status.textContent = 'Add your name and a short message.';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Pinning...';
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, message, website: field.website.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.entry) entries = [data.entry, ...entries];
      field.message.value = '';
      $('gb-count').textContent = '0/200';
      status.textContent = 'Pinned! Thanks for stopping by.';
      render();
      drawBoard(entries);
      list.firstElementChild?.classList.add('fresh');
      toast('Your note is on the board');
      onSigned();
    } catch (err) {
      status.textContent = err.message || 'Could not pin your note. Check your connection.';
    } finally {
      button.disabled = false;
    }
  });
  $('gb-close').onclick = () => dialog.close();
  // Click on the backdrop closes it too.
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  drawBoard([]);
  // Fetch the notes once the game is idle, so the board fills in without slowing the first frame.
  (window.requestIdleCallback || setTimeout)(load);

  return {
    spot: GUESTBOOK,
    open() {
      if (dialog.open) return;
      dialog.showModal();
      load();
    },
  };
}
