'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { hashPasscode, verifyPasscode, sign, verifyToken, rateLimit } = require('./auth');
const v = require('./validate');
const { localParts } = require('./time');
const { scheduleFor, adherence, insights, daysOfStockLeft } = require('./care');
const { runReminders, collectReminders } = require('./reminders');

const id = () => crypto.randomBytes(8).toString('hex');
const careCode = () => `CC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  });
  next();
}

/** Strip secrets before sending a profile to a client. */
function publicProfile(p) {
  const { passcodeHash, doses, activity, ...rest } = p;
  return {
    ...rest,
    medications: p.medications.map((m) => ({ ...m, daysLeft: daysOfStockLeft(m) })),
    appointments: [...p.appointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
  };
}

function createApp({ store, mailer }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '50kb' }));
  const publicDir = path.join(__dirname, '..', 'public');
  app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  app.use(express.static(publicDir, { maxAge: '1h', index: false }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.AUTH_RATE_MAX || 20) });
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  function log(profile, actor, text) {
    profile.activity.unshift({ at: new Date().toISOString(), by: actor, text });
    profile.activity.length = Math.min(profile.activity.length, 200);
  }

  function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const payload = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!payload) return res.status(401).json({ error: 'Please sign in again.' });
    const profile = store.getProfile(payload.pid);
    const member = profile && profile.members.find((m) => m.id === payload.mid);
    if (!member || payload.ver !== profile.passcodeVersion) return res.status(401).json({ error: 'Session no longer valid.' });
    req.profile = profile; req.member = member;
    next();
  }
  const actor = (req) => `${req.member.name} (${req.member.role})`;
  const save = (req) => store.saveProfile(req.profile);
  const session = (profile, member) => ({
    token: sign({ pid: profile.id, mid: member.id, ver: profile.passcodeVersion }),
    profileId: profile.id, member,
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  // ---------- Profiles & access ----------
  app.post('/api/profiles', authLimiter, (req, res) => {
    const b = req.body || {};
    const passcode = v.passcode(b.passcode);
    const profile = {
      id: careCode(),
      name: v.str(b.name, 'name', { required: true, max: 80 }),
      dob: v.date(b.dob, 'dob'),
      conditions: v.str(b.conditions, 'conditions', { max: 500 }),
      allergies: v.str(b.allergies, 'allergies', { max: 500 }),
      emergencyContact: v.str(b.emergencyContact, 'emergencyContact', { max: 200 }),
      doctorContact: v.str(b.doctorContact, 'doctorContact', { max: 200 }),
      passcodeHash: hashPasscode(passcode),
      passcodeVersion: 1,
      members: [],
      medications: [], doses: [], appointments: [], activity: [],
      createdAt: new Date().toISOString(),
    };
    const member = {
      id: id(),
      name: v.str(b.yourName, 'yourName', { required: true, max: 80 }),
      email: v.email(b.yourEmail, 'yourEmail'),
      role: v.role(b.yourRole || 'caretaker'),
      notify: true,
    };
    profile.members.push(member);
    log(profile, `${member.name} (${member.role})`, `Created care profile for ${profile.name}`);
    store.saveProfile(profile);
    res.status(201).json(session(profile, member));
  });

  // Sign in (or join the care circle) with the shared care code + passcode.
  app.post('/api/login', authLimiter, (req, res) => {
    const b = req.body || {};
    const profileId = v.str(b.profileId, 'profileId', { required: true, max: 20 }).toUpperCase();
    const profile = store.getProfile(profileId);
    if (!profile || !verifyPasscode(String(b.passcode || ''), profile.passcodeHash)) {
      return res.status(401).json({ error: 'Care code or passcode is incorrect.' });
    }
    const name = v.str(b.name, 'name', { required: true, max: 80 });
    const email = v.email(b.email, 'email');
    let member = profile.members.find((m) => (email && m.email === email) || (!email && m.name.toLowerCase() === name.toLowerCase()));
    if (!member) {
      member = { id: id(), name, email, role: v.role(b.role || 'family'), notify: true };
      profile.members.push(member);
      log(profile, `${name} (${member.role})`, 'Joined the care circle');
      store.saveProfile(profile);
    }
    res.json(session(profile, member));
  });

  app.get('/api/me', requireAuth, (req, res) => res.json({ member: req.member, profile: publicProfile(req.profile), emailMode: mailer.mode }));

  app.put('/api/profile', requireAuth, (req, res) => {
    const b = req.body || {}; const p = req.profile;
    for (const f of ['conditions', 'allergies', 'emergencyContact', 'doctorContact']) if (f in b) p[f] = v.str(b[f], f, { max: 500 });
    if ('name' in b) p.name = v.str(b.name, 'name', { required: true, max: 80 });
    if ('dob' in b) p.dob = v.date(b.dob, 'dob');
    log(p, actor(req), 'Updated health profile');
    save(req);
    res.json(publicProfile(p));
  });

  app.put('/api/profile/passcode', requireAuth, authLimiter, (req, res) => {
    const p = req.profile;
    if (!verifyPasscode(String(req.body.current || ''), p.passcodeHash)) return res.status(403).json({ error: 'Current passcode is incorrect.' });
    p.passcodeHash = hashPasscode(v.passcode(req.body.next));
    p.passcodeVersion += 1; // invalidates every existing session
    log(p, actor(req), 'Changed the shared passcode');
    save(req);
    res.json(session(p, req.member));
  });

  // ---------- Members ----------
  app.put('/api/members/:mid', requireAuth, (req, res) => {
    const m = req.profile.members.find((x) => x.id === req.params.mid);
    if (!m) return res.status(404).json({ error: 'Member not found' });
    const b = req.body || {};
    if ('name' in b) m.name = v.str(b.name, 'name', { required: true, max: 80 });
    if ('email' in b) m.email = v.email(b.email);
    if ('role' in b) m.role = v.role(b.role);
    if ('notify' in b) m.notify = Boolean(b.notify);
    log(req.profile, actor(req), `Updated member ${m.name}`);
    save(req);
    res.json(m);
  });
  app.delete('/api/members/:mid', requireAuth, (req, res) => {
    const p = req.profile;
    const idx = p.members.findIndex((x) => x.id === req.params.mid);
    if (idx < 0) return res.status(404).json({ error: 'Member not found' });
    if (p.members.length === 1) return res.status(400).json({ error: 'A care circle needs at least one member.' });
    const [m] = p.members.splice(idx, 1);
    log(p, actor(req), `Removed member ${m.name}`);
    save(req);
    res.status(204).end();
  });

  // ---------- Medications ----------
  function medFromBody(b, existing = {}) {
    const has = (k) => k in b;
    const med = {
      ...existing,
      name: has('name') || !existing.name ? v.str(b.name, 'name', { required: true, max: 100 }) : existing.name,
      dosage: has('dosage') ? v.str(b.dosage, 'dosage', { max: 100 }) : existing.dosage || '',
      instructions: has('instructions') ? v.str(b.instructions, 'instructions', { max: 300 }) : existing.instructions || '',
      times: has('times') || !existing.times ? v.times(b.times) : existing.times,
      startDate: has('startDate') ? v.date(b.startDate, 'startDate') : existing.startDate || '',
      endDate: has('endDate') ? v.date(b.endDate, 'endDate') : existing.endDate || '',
      stock: has('stock') ? v.int(b.stock, 'stock') : existing.stock ?? null,
      active: has('active') ? Boolean(b.active) : existing.active ?? true,
    };
    if (med.startDate && med.endDate && med.endDate < med.startDate) throw new v.ValidationError('endDate must be after startDate');
    return med;
  }
  app.get('/api/medications', requireAuth, (req, res) => res.json(publicProfile(req.profile).medications));
  app.post('/api/medications', requireAuth, (req, res) => {
    const nowParts = localParts();
    const med = { id: id(), createdDate: nowParts.date, createdTime: nowParts.time, ...medFromBody(req.body || {}) };
    req.profile.medications.push(med);
    log(req.profile, actor(req), `Added medication ${med.name} at ${med.times.join(', ')}`);
    save(req);
    res.status(201).json({ ...med, daysLeft: daysOfStockLeft(med) });
  });
  app.put('/api/medications/:id', requireAuth, (req, res) => {
    const list = req.profile.medications;
    const idx = list.findIndex((m) => m.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Medication not found' });
    list[idx] = medFromBody(req.body || {}, list[idx]);
    log(req.profile, actor(req), `Edited medication ${list[idx].name}`);
    save(req);
    res.json({ ...list[idx], daysLeft: daysOfStockLeft(list[idx]) });
  });
  app.delete('/api/medications/:id', requireAuth, (req, res) => {
    const p = req.profile;
    const med = p.medications.find((m) => m.id === req.params.id);
    if (!med) return res.status(404).json({ error: 'Medication not found' });
    p.medications = p.medications.filter((m) => m !== med);
    p.doses = p.doses.filter((d) => d.medId !== med.id);
    log(p, actor(req), `Removed medication ${med.name}`);
    save(req);
    res.status(204).end();
  });

  // ---------- Schedule & adherence ----------
  app.get('/api/schedule', requireAuth, (req, res) => {
    const date = v.date(req.query.date, 'date') || localParts().date;
    res.json({ date, items: scheduleFor(req.profile, date) });
  });
  app.post('/api/doses', requireAuth, (req, res) => {
    const b = req.body || {}; const p = req.profile;
    const med = p.medications.find((m) => m.id === b.medId);
    if (!med) return res.status(404).json({ error: 'Medication not found' });
    const date = v.date(b.date, 'date', true);
    const time = String(b.time || '');
    if (!med.times.includes(time)) throw new v.ValidationError('time is not part of this medication schedule');
    if (date > localParts().date) throw new v.ValidationError('Cannot record future doses');
    const status = b.status;
    if (!['taken', 'skipped', 'undo'].includes(status)) throw new v.ValidationError('status must be taken, skipped or undo');
    const prev = p.doses.find((d) => d.medId === med.id && d.date === date && d.time === time);
    if (prev && prev.status === 'taken' && med.stock !== null && med.stock !== undefined) med.stock += 1;
    p.doses = p.doses.filter((d) => d !== prev);
    if (status !== 'undo') {
      p.doses.push({ medId: med.id, date, time, status, by: req.member.name, at: new Date().toISOString() });
      if (status === 'taken' && med.stock !== null && med.stock !== undefined) med.stock = Math.max(0, med.stock - 1);
    }
    log(p, actor(req), `${status === 'undo' ? 'Cleared' : `Marked ${status}`}: ${med.name} ${date} ${time}`);
    save(req);
    res.json({ items: scheduleFor(p, date) });
  });
  app.get('/api/adherence', requireAuth, (req, res) => {
    const days = v.int(req.query.days, 'days', { min: 1, max: 90 }) || 7;
    res.json(adherence(req.profile, days));
  });
  app.get('/api/insights', requireAuth, (req, res) => res.json(insights(req.profile)));
  app.get('/api/activity', requireAuth, (req, res) => res.json(req.profile.activity.slice(0, 50)));

  // ---------- Appointments ----------
  function apptFromBody(b, existing = {}) {
    const has = (k) => k in b;
    const time = has('time') || !existing.time ? String(b.time || '') : existing.time;
    if (!v.TIME_RE.test(time)) throw new v.ValidationError('time must be HH:MM');
    return {
      ...existing,
      doctor: has('doctor') || !existing.doctor ? v.str(b.doctor, 'doctor', { required: true, max: 100 }) : existing.doctor,
      specialty: has('specialty') ? v.str(b.specialty, 'specialty', { max: 100 }) : existing.specialty || '',
      location: has('location') ? v.str(b.location, 'location', { max: 200 }) : existing.location || '',
      notes: has('notes') ? v.str(b.notes, 'notes', { max: 500 }) : existing.notes || '',
      date: has('date') || !existing.date ? v.date(b.date, 'date', true) : existing.date,
      time,
    };
  }
  app.get('/api/appointments', requireAuth, (req, res) => res.json(publicProfile(req.profile).appointments));
  app.post('/api/appointments', requireAuth, (req, res) => {
    const a = { id: id(), ...apptFromBody(req.body || {}) };
    req.profile.appointments.push(a);
    log(req.profile, actor(req), `Scheduled appointment with ${a.doctor} on ${a.date} ${a.time}`);
    save(req);
    res.status(201).json(a);
  });
  app.put('/api/appointments/:id', requireAuth, (req, res) => {
    const list = req.profile.appointments;
    const idx = list.findIndex((a) => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Appointment not found' });
    list[idx] = apptFromBody(req.body || {}, list[idx]);
    log(req.profile, actor(req), `Updated appointment with ${list[idx].doctor}`);
    save(req);
    res.json(list[idx]);
  });
  app.delete('/api/appointments/:id', requireAuth, (req, res) => {
    const p = req.profile;
    const a = p.appointments.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: 'Appointment not found' });
    p.appointments = p.appointments.filter((x) => x !== a);
    log(p, actor(req), `Cancelled appointment with ${a.doctor}`);
    save(req);
    res.status(204).end();
  });

  // ---------- Reminders ----------
  app.get('/api/reminders/preview', requireAuth, (req, res) => {
    res.json({ mode: mailer.mode, pending: collectReminders(req.profile, store).map((r) => r.msg) });
  });
  app.get('/api/reminders/outbox', requireAuth, (req, res) => {
    const mine = new Set(req.profile.members.map((m) => m.email).filter(Boolean));
    const box = (mailer.outbox || []).filter((m) => m.to.split(',').some((e) => mine.has(e)));
    res.json({ mode: mailer.mode, messages: box.slice(-30).reverse() });
  });
  app.post('/api/reminders/run', requireAuth, wrap(async (req, res) => {
    const sent = await runReminders({ allProfiles: () => [req.profile], wasSent: (k) => store.wasSent(k), markSent: (k) => store.markSent(k) }, mailer);
    res.json({ sent });
  }));
  // For Cloud Scheduler: protected by a shared secret header.
  app.post('/internal/reminders/tick', wrap(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('x-cron-secret') !== secret) return res.status(403).json({ error: 'forbidden' });
    res.json({ sent: await runReminders(store, mailer) });
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });
  return app;
}

module.exports = { createApp, publicProfile };
