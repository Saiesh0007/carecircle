'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { Store } = require('../src/store');
const { createMailer, collectReminders, runReminders } = require('../src/reminders');
const { scheduleFor, adherence, insights } = require('../src/care');
const { hashPasscode, verifyPasscode, sign, verifyToken } = require('../src/auth');
const { localParts, addDays } = require('../src/time');

let server; let base; let store; let mailer;
before(async () => {
  store = new Store(null); mailer = createMailer();
  server = createApp({ store, mailer }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}
async function newCircle() {
  const r = await call('/api/profiles', { method: 'POST', body: { name: 'Asha', passcode: 'secret123', yourName: 'Ravi', yourEmail: 'ravi@example.com', yourRole: 'caretaker' } });
  assert.equal(r.status, 201);
  return r.body;
}

test('passcode hashing and token signing', () => {
  const h = hashPasscode('abcdef');
  assert.ok(verifyPasscode('abcdef', h));
  assert.ok(!verifyPasscode('abcdeg', h));
  const t = sign({ pid: 'x' });
  assert.equal(verifyToken(t).pid, 'x');
  assert.equal(verifyToken(`${t}x`), null);
  assert.equal(verifyToken('garbage'), null);
});

test('security headers and health', async () => {
  const r = await call('/healthz');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('create circle, wrong passcode rejected, family joins', async () => {
  const s = await newCircle();
  assert.match(s.profileId, /^CC-[0-9A-F]{8}$/);
  const bad = await call('/api/login', { method: 'POST', body: { profileId: s.profileId, passcode: 'nope', name: 'X' } });
  assert.equal(bad.status, 401);
  const join = await call('/api/login', { method: 'POST', body: { profileId: s.profileId.toLowerCase(), passcode: 'secret123', name: 'Meera', email: 'meera@example.com', role: 'family' } });
  assert.equal(join.status, 200);
  const me = await call('/api/me', { token: join.body.token });
  assert.equal(me.body.profile.members.length, 2);
  assert.equal(me.body.profile.passcodeHash, undefined, 'hash must never leak');
});

test('unauthenticated access is blocked', async () => {
  assert.equal((await call('/api/medications')).status, 401);
  assert.equal((await call('/api/medications', { token: 'forged.token' })).status, 401);
});

test('validation errors return 400', async () => {
  const s = await newCircle();
  const r = await call('/api/medications', { method: 'POST', token: s.token, body: { name: 'X', times: ['25:00'] } });
  assert.equal(r.status, 400);
  const r2 = await call('/api/profiles', { method: 'POST', body: { name: 'A', passcode: '123', yourName: 'B' } });
  assert.equal(r2.status, 400);
});

test('medication CRUD, dose tracking and stock', async () => {
  const s = await newCircle();
  const created = await call('/api/medications', { method: 'POST', token: s.token, body: { name: 'Metformin', dosage: '500mg', times: ['23:59', '23:58'], stock: 10 } });
  assert.equal(created.status, 201);
  const med = created.body;
  assert.deepEqual(med.times, ['23:58', '23:59']);
  const today = localParts().date;
  const dose = await call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: today, time: '23:58', status: 'taken' } });
  assert.equal(dose.status, 200);
  assert.equal(dose.body.items.find((i) => i.time === '23:58').status, 'taken');
  let list = await call('/api/medications', { token: s.token });
  assert.equal(list.body[0].stock, 9);
  await call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: today, time: '23:58', status: 'undo' } });
  list = await call('/api/medications', { token: s.token });
  assert.equal(list.body[0].stock, 10);
  const future = await call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: addDays(today, 2), time: '23:58', status: 'taken' } });
  assert.equal(future.status, 400);
  const upd = await call(`/api/medications/${med.id}`, { method: 'PUT', token: s.token, body: { dosage: '1000mg' } });
  assert.equal(upd.body.dosage, '1000mg');
  assert.equal(upd.body.name, 'Metformin');
  assert.equal((await call(`/api/medications/${med.id}`, { method: 'DELETE', token: s.token })).status, 204);
  assert.equal((await call(`/api/medications/${med.id}`, { method: 'DELETE', token: s.token })).status, 404);
});

test('appointments CRUD', async () => {
  const s = await newCircle();
  const a = await call('/api/appointments', { method: 'POST', token: s.token, body: { doctor: 'Dr. Rao', date: '2030-01-01', time: '10:30', location: 'City Clinic' } });
  assert.equal(a.status, 201);
  const u = await call(`/api/appointments/${a.body.id}`, { method: 'PUT', token: s.token, body: { time: '11:00' } });
  assert.equal(u.body.time, '11:00');
  assert.equal((await call('/api/appointments', { token: s.token })).body.length, 1);
  assert.equal((await call(`/api/appointments/${a.body.id}`, { method: 'DELETE', token: s.token })).status, 204);
});

test('changing passcode invalidates old sessions', async () => {
  const s = await newCircle();
  const r = await call('/api/profile/passcode', { method: 'PUT', token: s.token, body: { current: 'secret123', next: 'newsecret' } });
  assert.equal(r.status, 200);
  assert.equal((await call('/api/me', { token: s.token })).status, 401);
  assert.equal((await call('/api/me', { token: r.body.token })).status, 200);
});

function fixture() {
  return {
    id: 'CC-TEST', name: 'Asha',
    members: [{ id: 'm1', name: 'Ravi', email: 'ravi@example.com', role: 'caretaker', notify: true }, { id: 'm2', name: 'Off', email: 'off@example.com', role: 'family', notify: false }],
    medications: [{ id: 'med1', name: 'Aspirin', dosage: '75mg', times: ['08:00', '20:00'], stock: 4, active: true }],
    doses: [{ medId: 'med1', date: '2026-01-10', time: '08:00', status: 'taken' }],
    appointments: [{ id: 'a1', doctor: 'Dr. Rao', date: '2026-01-11', time: '09:00' }],
    activity: [],
  };
}

test('schedule statuses: taken, missed, due, pending', () => {
  const p = fixture();
  const at = (minutes) => ({ date: '2026-01-10', minutes });
  assert.deepEqual(scheduleFor(p, '2026-01-10', at(9 * 60)).map((s) => s.status), ['taken', 'pending']);
  assert.equal(scheduleFor(p, '2026-01-10', at(20 * 60 + 5))[1].status, 'due');
  assert.equal(scheduleFor(p, '2026-01-10', at(21 * 60))[1].status, 'missed');
});

test('adherence and insights', () => {
  const p = fixture();
  const a = adherence(p, 1, { date: '2026-01-10', minutes: 23 * 60 });
  assert.equal(a.taken, 1); assert.equal(a.total, 2); assert.equal(a.rate, 50);
  const ins = insights(p, { date: '2026-01-10', minutes: 600 });
  assert.ok(ins.some((i) => i.type === 'refill'));
  assert.ok(ins.some((i) => i.type === 'appointment'));
});

test('reminders: upcoming, missed, appointment, refill; deduped; respects opt-out', async () => {
  const p = fixture();
  const s = new Store(null); s.saveProfile(p);
  const up = collectReminders(p, s, { date: '2026-01-10', minutes: 19 * 60 + 50 });
  const subjects = up.map((r) => r.msg.subject);
  assert.ok(subjects.some((x) => x.startsWith('Upcoming dose')));
  assert.ok(subjects.some((x) => x.startsWith('Appointment tomorrow')));
  assert.ok(subjects.some((x) => x.startsWith('Refill needed')));
  assert.ok(up.every((r) => !r.msg.to.includes('off@example.com')));
  const m = createMailer();
  const now = { date: '2026-01-10', minutes: 21 * 60 };
  const sent = await runReminders(s, m, now);
  assert.ok(m.outbox.some((x) => x.subject.startsWith('Missed dose')));
  assert.equal(await runReminders(s, m, now), 0, 'no duplicate emails');
  assert.ok(sent > 0);
});

test('cron endpoint requires secret', async () => {
  assert.equal((await call('/internal/reminders/tick', { method: 'POST' })).status, 403);
});
