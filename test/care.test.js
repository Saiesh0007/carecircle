'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scheduleFor, adherence, insights, riskForecast, daysOfStockLeft } = require('../src/care');
const { buildDemoProfile } = require('../src/demo');
const { addDays, localParts } = require('../src/time');

function fixture() {
  return {
    id: 'CC-TEST', name: 'Asha',
    members: [],
    medications: [{ id: 'med1', name: 'Aspirin', dosage: '75mg', times: ['08:00', '20:00'], stock: 4, active: true }],
    doses: [{ medId: 'med1', date: '2026-01-10', time: '08:00', status: 'taken' }],
    appointments: [{ id: 'a1', doctor: 'Dr. Rao', date: '2026-01-11', time: '09:00' }],
    activity: [],
  };
}
const at = (date, h, m = 0) => ({ date, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, minutes: h * 60 + m });

test('schedule statuses move from pending to due to missed', () => {
  const p = fixture();
  assert.deepEqual(scheduleFor(p, '2026-01-10', at('2026-01-10', 9)).map((s) => s.status), ['taken', 'pending']);
  assert.equal(scheduleFor(p, '2026-01-10', at('2026-01-10', 20, 5))[1].status, 'due');
  assert.equal(scheduleFor(p, '2026-01-10', at('2026-01-10', 21))[1].status, 'missed');
  assert.equal(scheduleFor(p, '2026-01-09', at('2026-01-10', 7))[0].status, 'missed', 'past days without a record are missed');
});

test('medicines respect start/end dates, inactive flag and creation time', () => {
  const p = fixture();
  p.medications.push({ id: 'm2', name: 'Short course', times: ['10:00'], startDate: '2026-01-05', endDate: '2026-01-07', active: true });
  p.medications.push({ id: 'm3', name: 'Paused', times: ['10:00'], active: false });
  p.medications.push({ id: 'm4', name: 'New today', times: ['07:00', '22:00'], createdDate: '2026-01-10', createdTime: '16:00', active: true });
  const names = scheduleFor(p, '2026-01-10', at('2026-01-10', 17)).map((s) => `${s.name}@${s.time}`);
  assert.ok(!names.some((n) => n.startsWith('Short course')));
  assert.ok(!names.some((n) => n.startsWith('Paused')));
  assert.ok(names.includes('New today@22:00'));
  assert.ok(!names.includes('New today@07:00'), 'a slot before the medicine was added is not reported as missed');
  assert.equal(scheduleFor(p, '2026-01-06', at('2026-01-10', 17)).filter((s) => s.name === 'Short course').length, 1);
});

test('adherence counts only decided doses and computes streaks', () => {
  const p = fixture();
  const a = adherence(p, 1, at('2026-01-10', 23));
  assert.equal(a.taken, 1); assert.equal(a.total, 2); assert.equal(a.rate, 50); assert.equal(a.streak, 0);
  assert.equal(adherence(fixture(), 1, at('2026-01-10', 9)).total, 1, 'pending doses are not counted yet');
  p.doses.push({ medId: 'med1', date: '2026-01-10', time: '20:00', status: 'taken' });
  assert.equal(adherence(p, 1, at('2026-01-10', 23)).streak, 1);
  // yesterday perfect + today imperfect so far -> streak keeps yesterday
  const q = fixture();
  q.doses.push({ medId: 'med1', date: '2026-01-09', time: '08:00', status: 'taken' }, { medId: 'med1', date: '2026-01-09', time: '20:00', status: 'taken' });
  assert.equal(adherence(q, 2, at('2026-01-10', 23)).streak, 1);
});

test('stock days and insights (refill, pattern, appointment)', () => {
  const p = fixture();
  assert.equal(daysOfStockLeft(p.medications[0]), 2);
  assert.equal(daysOfStockLeft({ times: ['08:00'], stock: null }), null);
  const ins = insights(p, at('2026-01-10', 10));
  assert.ok(ins.some((i) => i.key === 'insRefill' && i.params.days === 2));
  assert.ok(ins.some((i) => i.key === 'insAppt'));
  // Missed 20:00 for 5 days -> pattern insight
  const q = fixture();
  q.medications[0].stock = null;
  for (let i = 1; i <= 5; i++) q.doses.push({ medId: 'med1', date: addDays('2026-01-10', -i), time: '08:00', status: 'taken' });
  q.medications[0].createdDate = addDays('2026-01-10', -5);
  const pat = insights(q, at('2026-01-10', 10)).find((i) => i.key === 'insPattern');
  assert.equal(pat.params.time, '20:00');
  assert.equal(pat.params.count, 5);
});

test('risk model ranks a habitually missed slot above a reliable one', () => {
  const p = { id: 'x', name: 'x', members: [], appointments: [], activity: [], doses: [], medications: [{ id: 'm', name: 'M', times: ['08:00', '21:00'], active: true, createdDate: '2025-12-01' }] };
  const now = at('2026-01-10', 7);
  for (let i = 1; i <= 21; i++) {
    const date = addDays(now.date, -i);
    p.doses.push({ medId: 'm', date, time: '08:00', status: 'taken' });
    if (i % 3 === 0) p.doses.push({ medId: 'm', date, time: '21:00', status: 'taken' }); // evening missed 2/3 of days
  }
  const risk = riskForecast(p, now);
  assert.equal(risk[0].time, '21:00');
  assert.ok(risk[0].risk > risk[1].risk + 25, `expected clear separation, got ${risk.map((r) => r.risk)}`);
  assert.equal(risk[0].level, 'high');
  assert.ok(risk[0].reasons.some((r) => r.key === 'riskSlot'));
  assert.equal(risk[1].level, 'low');
});

test('risk model stays near the prior without history', () => {
  const p = { id: 'x', name: 'x', members: [], appointments: [], activity: [], doses: [], medications: [{ id: 'm', name: 'M', times: ['20:00'], active: true, createdDate: '2026-01-10' }] };
  const [r] = riskForecast(p, at('2026-01-10', 7));
  assert.ok(r.risk >= 5 && r.risk <= 15, `got ${r.risk}`);
});

test('demo profile is realistic, localized and expires', () => {
  const now = localParts();
  const { profile, member, passcode } = buildDemoProfile({ lang: 'hi', seed: 7, now });
  assert.equal(profile.demo, true);
  assert.ok(Date.parse(profile.expiresAt) > Date.now());
  assert.match(profile.name, /[ऀ-ॿ]/, 'Hindi demo uses Devanagari');
  assert.equal(member.role, 'family');
  assert.equal(passcode, 'demo1234');
  const ad = adherence(profile, 14, now);
  assert.ok(ad.rate > 50 && ad.rate < 100, `adherence ${ad.rate}`);
  assert.ok(ad.streak >= 3, 'recent days are perfect');
  assert.ok(insights(profile, now).some((i) => i.key === 'insRefill'));
});
