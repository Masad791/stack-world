// Run: node tests/guestbook.test.mjs
import assert from 'node:assert/strict';
import { handle } from '../netlify/functions/guestbook.mjs';

const mem = new Map();
const store = {
  get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
  setJSON: async (k, v) => void mem.set(k, JSON.stringify(v)),
};
const post = (body, ip = '1.1.1.1', now = 1e6) =>
  handle(new Request('http://x/api/guestbook', { method: 'POST', body: JSON.stringify(body) }), store, ip, now);
const get = async () => (await (await handle(new Request('http://x/api/guestbook'), store, '')).json()).entries;

assert.equal((await post({ name: 'Ana', message: 'Lovely island!' })).status, 201);
assert.equal((await post({ name: 'Ana', message: 'again' }, '1.1.1.1', 1e6 + 5000)).status, 429); // rate limit
assert.equal((await post({ name: 'Bo', message: 'hi' }, '2.2.2.2', 1e6 + 40000)).status, 201);
assert.equal((await post({ name: '', message: 'x' }, '3.3.3.3')).status, 400);
assert.equal((await post({ name: 'Spam', message: 'visit www.spam.com' }, '4.4.4.4')).status, 400);
assert.equal((await post({ name: 'Bot', message: 'hello', website: 'x' }, '5.5.5.5')).status, 200); // honeypot: not stored
assert.equal((await post({ name: 'Cy\u0007 ', message: '  spaced \n out  ' }, '6.6.6.6')).status, 201);
const entries = await get();
assert.deepEqual(entries.map((e) => e.name), ['Cy', 'Bo', 'Ana']); // newest first, cleaned
assert.equal(entries[0].message, 'spaced out');
assert.ok(![...mem.keys()].some((k) => k.includes('1.1.1.1'))); // raw IPs never stored
console.log('guestbook ok');
