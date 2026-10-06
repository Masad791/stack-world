import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

// Guestbook API: GET the latest notes, POST a new one. Notes live in Netlify Blobs as one JSON list.
// ponytail: one list read-modify-written per post; two posts in the same instant can drop one.
// Fine at guestbook traffic, move to one blob per note if it ever gets busy.
const KEEP = 300;
const SHOW = 80;
const GAP_MS = 30_000;

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function handle(req, store, ip, now = Date.now()) {
  if (req.method === 'GET') {
    const list = (await store.get('entries', { type: 'json' })) ?? [];
    return json({ entries: list.slice(0, SHOW) });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (body?.website) return json({ ok: true }); // honeypot: only bots fill the hidden field
  const name = clean(body?.name, 24);
  const message = clean(body?.message, 200);
  if (!name || message.length < 2) return json({ error: 'Add your name and a short message.' }, 400);
  if (/https?:|www\.|\.(com|net|org|io|xyz|ru|top)\b/i.test(`${name} ${message}`)) return json({ error: 'Links are not allowed in notes.' }, 400);

  // One note per visitor every 30 s. The IP is only kept as a short hash.
  const key = `ip:${createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 24)}`;
  const last = await store.get(key, { type: 'json' });
  if (last && now - last.t < GAP_MS) return json({ error: 'One note every 30 seconds, please.' }, 429);

  const entry = { name, message, ts: now };
  const list = (await store.get('entries', { type: 'json' })) ?? [];
  await store.setJSON('entries', [entry, ...list].slice(0, KEEP));
  await store.setJSON(key, { t: now });
  return json({ entry }, 201);
}

export default (req, context) => handle(req, getStore({ name: 'guestbook', consistency: 'strong' }), context.ip);

export const config = { path: '/api/guestbook' };
