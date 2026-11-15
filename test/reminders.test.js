'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FileStore } = require('../src/store');
const { createMailer, dueReminders, collectReminders, runReminders } = require('../src/reminders');

function fixture(extra = {}) {
  return {
    id: 'CC-TEST', name: 'Asha',
    members: [
      { id: 'm1', name: 'Ravi', email: 'ravi@example.com', role: 'caretaker', notify: true, lang: 'en' },
      { id: 'm2', name: 'Meera', email: 'meera@example.com', role: 'family', notify: true, lang: 'hi' },
      { id: 'm3', name: 'Off', email: 'off@example.com', role: 'family', notify: false },
      { id: 'm4', name: 'Asha', email: 'asha@example.com', role: 'elder', notify: true },
    ],
    medications: [{ id: 'med1', name: 'Aspirin', dosage: '75mg', times: ['08:00', '20:00'], stock: 4, active: true }],
    doses: [{ medId: 'med1', date: '2026-01-10', time: '08:00', status: 'taken' }],
    appointments: [{ id: 'a1', doctor: 'Dr. Rao', date: '2026-01-11', time: '09:00', location: 'Clinic' }],
    activity: [],
    ...extra,
  };
}
const at = (h, m = 0) => ({ date: '2026-01-10', time: `${h}:${m}`, minutes: h * 60 + m });

test('upcoming, appointment and refill reminders are composed per member in their language', () => {
  const due = dueReminders(fixture(), at(19, 50));
  const subjects = due.map((r) => `${r.msg.to}|${r.msg.subject}`);
  assert.ok(subjects.includes('ravi@example.com|Upcoming dose: Aspirin at 20:00'));
  assert.ok(subjects.includes('meera@example.com|आने वाली खुराक: Aspirin 20:00 बजे'));
  assert.ok(subjects.some((s) => s.startsWith('ravi@example.com|Appointment tomorrow')));
  assert.ok(subjects.some((s) => s.startsWith('meera@example.com|कल अपॉइंटमेंट')));
  assert.ok(subjects.some((s) => s === 'ravi@example.com|Refill needed: Aspirin'));
  assert.ok(!subjects.some((s) => s.startsWith('asha@example.com|Refill')), 'refill reminders go to carers only');
  assert.ok(!subjects.some((s) => s.startsWith('off@example.com')), 'opted-out members get nothing');
});

test('missed-dose alerts fire after the grace period, and only once', async () => {
  const store = new FileStore(null);
  await store.saveProfile(fixture());
  const mailer = createMailer({ store });
  const now = at(21, 0);
  const sent = await runReminders(store, mailer, now);
  assert.ok(sent > 0);
  const box = await store.getOutbox('CC-TEST');
  assert.ok(box.some((m) => m.subject === 'Missed dose alert: Aspirin (20:00)'));
  assert.ok(box.some((m) => m.subject.startsWith('छूटी खुराक की सूचना')));
  assert.equal(await runReminders(store, mailer, now), 0, 'no duplicate emails');
  assert.equal((await collectReminders(fixture(), store, now)).length, 0);
});

test('appointment reminder 2 hours before', () => {
  const p = fixture({ appointments: [{ id: 'a2', doctor: 'Dr. Sen', date: '2026-01-10', time: '11:00' }] });
  const due = dueReminders(p, at(9, 30));
  assert.ok(due.some((r) => r.msg.subject === 'Appointment soon: Dr. Sen at 11:00'));
  assert.equal(dueReminders(p, at(8, 0)).filter((r) => r.msg.subject.startsWith('Appointment soon')).length, 0);
});

test('demo circles never send real email even when SMTP is configured', async () => {
  const store = new FileStore(null);
  await store.saveProfile(fixture({ id: 'CC-DEMO', demo: true }));
  let realSends = 0;
  const smtp = { mode: 'smtp', send: async () => { realSends += 1; } };
  const sent = await runReminders(store, smtp, at(21, 0));
  assert.ok(sent > 0);
  assert.equal(realSends, 0);
  assert.ok((await store.getOutbox('CC-DEMO')).length > 0);
});

test('a failing mail transport does not mark reminders as sent', async () => {
  const store = new FileStore(null);
  await store.saveProfile(fixture());
  const broken = { mode: 'smtp', send: async () => { throw new Error('smtp down'); } };
  assert.equal(await runReminders(store, broken, at(21, 0)), 0);
  assert.ok((await collectReminders(fixture(), store, at(21, 0))).length > 0, 'they will be retried');
});
