'use strict';
/** Auth primitives, storage backends, rate limiting and translation completeness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { hashPasscode, verifyPasscode, sign, verifyToken, parseCookies } = require('../src/auth');
const { FileStore, RedisStore, createStore } = require('../src/store');
const i18n = require('../src/i18n');
const { startServer } = require('./helpers');

test('passcodes are salted scrypt hashes verified in constant time', () => {
  const a = hashPasscode('abcdef'); const b = hashPasscode('abcdef');
  assert.notEqual(a, b, 'random salt');
  assert.ok(verifyPasscode('abcdef', a));
  assert.ok(!verifyPasscode('abcdeg', a));
  assert.ok(!verifyPasscode('abcdef', 'garbage'));
});

test('tokens are signed, expire, and are bound to a purpose', () => {
  const tok = sign({ pid: 'x' });
  assert.equal(verifyToken(tok).pid, 'x');
  assert.equal(verifyToken(`${tok}x`), null);
  assert.equal(verifyToken(tok, 'identity'), null, 'a session token cannot be used as an OAuth identity');
  assert.equal(verifyToken(sign({ a: 1 }, { ttlMs: -1 })), null, 'expired');
  assert.equal(verifyToken('garbage'), null);
  assert.equal(verifyToken(undefined), null);
});

test('cookie parser', () => {
  assert.deepEqual(parseCookies('a=1; b=hello%20world'), { a: '1', b: 'hello world' });
  assert.deepEqual(parseCookies(''), {});
});

test('file store isolates copies, indexes emails and drops expired profiles', async () => {
  const s = new FileStore(null);
  const p = { id: 'CC-1', members: [{ email: 'a@x.com' }], medications: [] };
  await s.saveProfile(p);
  const got = await s.getProfile('CC-1');
  got.medications.push('mutated');
  assert.equal((await s.getProfile('CC-1')).medications.length, 0, 'callers get a copy');
  assert.deepEqual(await s.findProfileIdsByEmail('a@x.com'), ['CC-1']);
  await s.saveProfile({ id: 'CC-2', members: [], expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(await s.getProfile('CC-2'), null);
  assert.deepEqual(await s.listProfileIds(), ['CC-1']);
});

/** Minimal in-memory imitation of the Upstash REST pipeline API. */
function fakeUpstash() {
  const kv = new Map(); const sets = new Map(); const lists = new Map();
  const set = (k) => { if (!sets.has(k)) sets.set(k, new Set()); return sets.get(k); };
  const run = ([cmd, ...a]) => {
    switch (cmd) {
      case 'GET': return kv.get(a[0]) ?? null;
      case 'SET': kv.set(a[0], a[1]); return 'OK';
      case 'DEL': kv.delete(a[0]); return 1;
      case 'EXISTS': return kv.has(a[0]) ? 1 : 0;
      case 'SADD': a.slice(1).forEach((x) => set(a[0]).add(x)); return 1;
      case 'SREM': a.slice(1).forEach((x) => set(a[0]).delete(x)); return 1;
      case 'SMEMBERS': return [...set(a[0])];
      case 'LPUSH': lists.set(a[0], [a[1], ...(lists.get(a[0]) || [])]); return 1;
      case 'LTRIM': lists.set(a[0], (lists.get(a[0]) || []).slice(Number(a[1]), Number(a[2]) + 1)); return 'OK';
      case 'LRANGE': return (lists.get(a[0]) || []).slice(Number(a[1]), Number(a[2]) + 1);
      case 'EXPIRE': return 1;
      default: return { error: `unknown ${cmd}` };
    }
  };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    return Response.json(JSON.parse(init.body).map((c) => { const r = run(c); return r && r.error ? r : { result: r }; }));
  };
  return { fetchImpl, kv, calls };
}

test('redis store speaks the Upstash pipeline protocol', async () => {
  const up = fakeUpstash();
  const s = new RedisStore({ url: 'https://example.upstash.io/', token: 'tkn', fetchImpl: up.fetchImpl });
  await s.saveProfile({ id: 'CC-9', members: [{ email: 'z@x.com' }], medications: [] });
  assert.equal((await s.getProfile('CC-9')).id, 'CC-9');
  assert.deepEqual(await s.findProfileIdsByEmail('z@x.com'), ['CC-9']);
  assert.deepEqual(await s.listProfileIds(), ['CC-9']);
  assert.equal(await s.wasSent('k'), false);
  await s.markSent('k');
  assert.equal(await s.wasSent('k'), true);
  await s.pushOutbox('CC-9', { subject: 'hi' });
  assert.equal((await s.getOutbox('CC-9'))[0].subject, 'hi');
  await s.deleteProfile('CC-9');
  assert.deepEqual(await s.listProfileIds(), []);
  assert.equal(up.calls[0].url, 'https://example.upstash.io/pipeline');
  assert.equal(up.calls[0].auth, 'Bearer tkn');
});

test('createStore picks Redis when Vercel KV / Upstash variables exist', () => {
  assert.equal(createStore({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' }).kind, 'redis');
  assert.equal(createStore({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }).kind, 'redis');
  assert.equal(createStore({ DATA_FILE: path.join(require('os').tmpdir(), 'cc-test-none.json') }).kind, 'file');
});

test('sign-in endpoints are rate limited', async () => {
  const prev = process.env.AUTH_RATE_MAX;
  process.env.AUTH_RATE_MAX = '3';
  const h = await startServer();
  try {
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await h.call('/api/login', { method: 'POST', body: { profileId: 'CC-00000000', passcode: 'x', name: 'x' } })).status);
    assert.deepEqual(codes, [401, 401, 401, 429, 429]);
  } finally {
    await h.close();
    if (prev === undefined) delete process.env.AUTH_RATE_MAX; else process.env.AUTH_RATE_MAX = prev;
  }
});

test('server messages exist in English and Hindi', () => {
  for (const key of Object.keys(i18n.MESSAGES.en)) assert.ok(i18n.MESSAGES.hi[key], `hi missing ${key}`);
  assert.equal(i18n.t('hi', 'required', { field: 'name' }), 'नाम आवश्यक है');
  assert.equal(i18n.t('xx', 'required', { field: 'name' }), 'Name is required');
});

test('every UI string used by the web app is translated in both languages', async () => {
  const pub = path.join(__dirname, '..', 'public');
  const src = fs.readFileSync(path.join(pub, 'js', 'i18n.js'), 'utf8');
  const { DICT } = await import(`data:text/javascript,${encodeURIComponent(src)}`);
  const files = ['index.html', ...fs.readdirSync(path.join(pub, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...fs.readdirSync(path.join(pub, 'js', 'views')).map((f) => `js/views/${f}`)];
  const used = new Set();
  for (const f of files) {
    const text = fs.readFileSync(path.join(pub, f), 'utf8');
    for (const m of text.matchAll(/data-i18n(?:-placeholder|-aria)?="(\w+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/\bt\('(\w+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size > 150);
  for (const lang of ['en', 'hi']) {
    const missing = [...used].filter((k) => !(k in DICT[lang]));
    assert.deepEqual(missing, [], `${lang} is missing translations`);
  }
  assert.deepEqual(Object.keys(DICT.en).filter((k) => !(k in DICT.hi)), [], 'Hindi covers every English key');
});
