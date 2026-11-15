'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const { localParts, addDays } = require('../src/time');

let h;
before(async () => { h = await startServer(); });
after(() => h.close());

test('security headers, health and static app', async () => {
  const r = await h.call('/healthz');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/, 'no inline scripts allowed');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
  const page = await h.call('/');
  assert.equal(page.status, 200);
  assert.match(page.body, /<html lang="en">/);
  const api = await h.call('/api/config');
  assert.equal(api.headers.get('cache-control'), 'no-store');
});

test('unknown API routes return a localized 404', async () => {
  const en = await h.call('/api/nope');
  assert.equal(en.status, 404);
  assert.equal(en.body.code, 'notFound');
  const hi = await h.call('/api/nope', { lang: 'hi' });
  assert.equal(hi.body.error, 'नहीं मिला');
});

test('create circle, wrong passcode rejected, family joins, secrets never leak', async () => {
  const s = await h.newCircle();
  assert.match(s.profileId, /^CC-[0-9A-F]{8}$/);
  const bad = await h.call('/api/login', { method: 'POST', body: { profileId: s.profileId, passcode: 'nope', name: 'X' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.code, 'badCredentials');
  const join = await h.call('/api/login', { method: 'POST', body: { profileId: s.profileId.toLowerCase(), passcode: 'secret123', name: 'Meera', email: 'meera@example.com', role: 'family', lang: 'hi' } });
  assert.equal(join.status, 200);
  assert.equal(join.body.member.lang, 'hi');
  const me = await h.call('/api/me', { token: join.body.token });
  assert.equal(me.body.profile.members.length, 2);
  assert.equal(me.body.profile.passcodeHash, undefined);
  assert.equal(me.body.profile.doses, undefined);
  // Signing in again with the same email reuses the member instead of duplicating it
  const again = await h.call('/api/login', { method: 'POST', body: { profileId: s.profileId, passcode: 'secret123', name: 'Meera K', email: 'MEERA@example.com' } });
  assert.equal(again.body.member.id, join.body.member.id);
});

test('authentication is required and forged/expired tokens are rejected', async () => {
  assert.equal((await h.call('/api/medications')).status, 401);
  assert.equal((await h.call('/api/medications', { token: 'forged.token' })).status, 401);
  const s = await h.newCircle();
  const [body, sig] = s.token.split('.');
  const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), pid: 'CC-00000000' })).toString('base64url');
  assert.equal((await h.call('/api/me', { token: `${tampered}.${sig}` })).status, 401);
});

test('validation errors are 400 with field-aware messages in English and Hindi', async () => {
  const s = await h.newCircle();
  const r = await h.call('/api/medications', { method: 'POST', token: s.token, body: { name: 'X', times: ['25:00'] } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'invalidTimes');
  const r2 = await h.call('/api/profiles', { method: 'POST', body: { name: 'A', passcode: '123', yourName: 'B' } });
  assert.equal(r2.body.code, 'passcodeShort');
  const r3 = await h.call('/api/medications', { method: 'POST', token: s.token, lang: 'hi', body: { name: '', times: ['08:00'] } });
  assert.equal(r3.body.error, 'नाम आवश्यक है');
  const r4 = await h.call('/api/medications', { method: 'POST', token: s.token, body: { name: 'A'.repeat(101), times: ['08:00'] } });
  assert.equal(r4.body.code, 'tooLong');
  const r5 = await h.call('/api/appointments', { method: 'POST', token: s.token, body: { doctor: 'X', date: '2026-02-30', time: '10:00' } });
  assert.equal(r5.body.code, 'invalidDate');
  const r6 = await h.call('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, raw: '{bad json' });
  assert.equal(r6.status, 400);
});

test('medication CRUD, dose tracking, undo and stock accounting', async () => {
  const s = await h.newCircle();
  const created = await h.call('/api/medications', { method: 'POST', token: s.token, body: { name: 'Metformin', dosage: '500mg', times: ['23:59', '23:58'], stock: 10 } });
  assert.equal(created.status, 201);
  const med = created.body;
  assert.deepEqual(med.times, ['23:58', '23:59']);
  assert.equal(med.daysLeft, 5);
  const today = localParts().date;
  const dose = await h.call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: today, time: '23:58', status: 'taken' } });
  assert.equal(dose.status, 200);
  assert.equal(dose.body.items.find((i) => i.time === '23:58').status, 'taken');
  assert.equal(dose.body.stock, 9);
  const redo = await h.call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: today, time: '23:58', status: 'taken' } });
  assert.equal(redo.body.stock, 9, 'marking taken twice does not double-count stock');
  const undo = await h.call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: today, time: '23:58', status: 'undo' } });
  assert.equal(undo.body.stock, 10);
  const future = await h.call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: addDays(today, 2), time: '23:58', status: 'taken' } });
  assert.equal(future.body.code, 'futureDose');
  const wrongSlot = await h.call('/api/doses', { method: 'POST', token: s.token, body: { medId: med.id, date: today, time: '10:00', status: 'taken' } });
  assert.equal(wrongSlot.body.code, 'timeNotInSchedule');
  const upd = await h.call(`/api/medications/${med.id}`, { method: 'PUT', token: s.token, body: { dosage: '1000mg' } });
  assert.equal(upd.body.dosage, '1000mg');
  assert.equal(upd.body.name, 'Metformin');
  const badDates = await h.call(`/api/medications/${med.id}`, { method: 'PUT', token: s.token, body: { startDate: '2026-02-01', endDate: '2026-01-01' } });
  assert.equal(badDates.body.code, 'endBeforeStart');
  assert.equal((await h.call(`/api/medications/${med.id}`, { method: 'DELETE', token: s.token })).status, 204);
  assert.equal((await h.call(`/api/medications/${med.id}`, { method: 'DELETE', token: s.token })).status, 404);
});

test('dashboard, history, adherence, risk and activity read models', async () => {
  const s = await h.newCircle();
  await h.call('/api/medications', { method: 'POST', token: s.token, body: { name: 'A', times: ['23:59'] } });
  const d = await h.call('/api/dashboard', { token: s.token });
  assert.equal(d.status, 200);
  for (const k of ['schedule', 'insights', 'risk', 'adherence', 'now']) assert.ok(k in d.body, k);
  const hist = await h.call('/api/history?days=5', { token: s.token });
  assert.equal(hist.body.length, 5);
  assert.equal((await h.call('/api/adherence?days=500', { token: s.token })).status, 400);
  const act = await h.call('/api/activity', { token: s.token });
  assert.deepEqual(act.body.map((a) => a.key).slice(0, 2), ['actMedAdd', 'actCreated']);
});

test('appointments CRUD', async () => {
  const s = await h.newCircle();
  const a = await h.call('/api/appointments', { method: 'POST', token: s.token, body: { doctor: 'Dr. Rao', date: '2030-01-01', time: '10:30', location: 'City Clinic' } });
  assert.equal(a.status, 201);
  const u = await h.call(`/api/appointments/${a.body.id}`, { method: 'PUT', token: s.token, body: { time: '11:00' } });
  assert.equal(u.body.time, '11:00');
  assert.equal(u.body.location, 'City Clinic');
  assert.equal((await h.call('/api/appointments', { token: s.token })).body.length, 1);
  assert.equal((await h.call(`/api/appointments/${a.body.id}`, { method: 'DELETE', token: s.token })).status, 204);
  assert.equal((await h.call(`/api/appointments/${a.body.id}`, { method: 'PUT', token: s.token, body: {} })).status, 404);
});

test('members: invite, update preferences, cannot remove the last member', async () => {
  const s = await h.newCircle();
  const inv = await h.call('/api/members', { method: 'POST', token: s.token, body: { name: 'Neel', email: 'neel@example.com', role: 'family' } });
  assert.equal(inv.status, 201);
  const dup = await h.call('/api/members', { method: 'POST', token: s.token, body: { name: 'Neel', email: 'neel@example.com' } });
  assert.equal(dup.status, 200);
  const off = await h.call(`/api/members/${inv.body.id}`, { method: 'PUT', token: s.token, body: { notify: false } });
  assert.equal(off.body.notify, false);
  assert.equal((await h.call(`/api/members/${inv.body.id}`, { method: 'DELETE', token: s.token })).status, 204);
  const last = await h.call(`/api/members/${s.member.id}`, { method: 'DELETE', token: s.token });
  assert.equal(last.body.code, 'lastMember');
  const lang = await h.call('/api/me', { method: 'PUT', token: s.token, body: { lang: 'hi' } });
  assert.equal(lang.body.lang, 'hi');
});

test('changing the passcode invalidates every other session', async () => {
  const s = await h.newCircle();
  const wrong = await h.call('/api/profile/passcode', { method: 'PUT', token: s.token, body: { current: 'nope', next: 'newsecret' } });
  assert.equal(wrong.status, 403);
  const r = await h.call('/api/profile/passcode', { method: 'PUT', token: s.token, body: { current: 'secret123', next: 'newsecret' } });
  assert.equal(r.status, 200);
  assert.equal((await h.call('/api/me', { token: s.token })).status, 401);
  assert.equal((await h.call('/api/me', { token: r.body.token })).status, 200);
  const login = await h.call('/api/login', { method: 'POST', body: { profileId: s.profileId, passcode: 'newsecret', name: 'Ravi', email: 'ravi@example.com' } });
  assert.equal(login.status, 200);
});

test('profile updates are validated and logged', async () => {
  const s = await h.newCircle();
  const r = await h.call('/api/profile', { method: 'PUT', token: s.token, body: { allergies: 'Penicillin', dob: '1950-05-05' } });
  assert.equal(r.body.allergies, 'Penicillin');
  assert.equal((await h.call('/api/profile', { method: 'PUT', token: s.token, body: { dob: 'yesterday' } })).status, 400);
});

test('demo creates a private, pre-filled circle with reminders in the outbox', async () => {
  const r = await h.call('/api/demo', { method: 'POST', body: { lang: 'en' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.passcode, 'demo1234');
  const me = await h.call('/api/me', { token: r.body.token });
  assert.equal(me.body.profile.demo, true);
  assert.ok(me.body.profile.medications.length >= 3);
  const box = await h.call('/api/reminders/outbox', { token: r.body.token });
  assert.ok(box.body.messages.some((m) => m.subject.startsWith('Refill needed')));
  const other = await h.call('/api/demo', { method: 'POST', body: {} });
  assert.notEqual(other.body.profileId, r.body.profileId, 'each visitor gets their own copy');
});

test('reminder endpoints: manual run and protected cron tick', async () => {
  const s = await h.newCircle();
  await h.call('/api/medications', { method: 'POST', token: s.token, body: { name: 'Low', times: ['23:59'], stock: 1 } });
  const run = await h.call('/api/reminders/run', { method: 'POST', token: s.token });
  assert.ok(run.body.sent >= 1);
  const again = await h.call('/api/reminders/run', { method: 'POST', token: s.token });
  assert.equal(again.body.sent, 0, 'reminders are deduplicated');
  assert.equal((await h.call('/internal/reminders/tick', { method: 'POST' })).status, 403);
  process.env.CRON_SECRET = 'cron-test-secret';
  try {
    assert.equal((await h.call('/internal/reminders/tick', { headers: { Authorization: 'Bearer wrong' } })).status, 403);
    const ok = await h.call('/internal/reminders/tick', { headers: { Authorization: 'Bearer cron-test-secret' } });
    assert.equal(ok.status, 200);
  } finally { delete process.env.CRON_SECRET; }
});

test('AI endpoints answer 503 when no Groq key is configured', async () => {
  const s = await h.newCircle();
  const r = await h.call('/api/ai/chat', { method: 'POST', token: s.token, body: { messages: [{ role: 'user', content: 'hi' }] } });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'aiUnavailable');
  assert.equal((await h.call('/api/config')).body.ai, false);
});
