'use strict';
/** Medications, dose tracking, appointments and the analytics read models. */
const express = require('express');
const v = require('../validate');
const { AppError } = require('../validate');
const { wrap, logActivity, newId } = require('../http');
const { localParts, addDays } = require('../time');
const { scheduleFor, adherence, insights, riskForecast, daysOfStockLeft } = require('../care');

const withDays = (m) => ({ ...m, daysLeft: daysOfStockLeft(m) });

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
  if (med.startDate && med.endDate && med.endDate < med.startDate) throw new AppError('endBeforeStart');
  return med;
}

function apptFromBody(b, existing = {}) {
  const has = (k) => k in b;
  return {
    ...existing,
    doctor: has('doctor') || !existing.doctor ? v.str(b.doctor, 'doctor', { required: true, max: 100 }) : existing.doctor,
    specialty: has('specialty') ? v.str(b.specialty, 'specialty', { max: 100 }) : existing.specialty || '',
    location: has('location') ? v.str(b.location, 'location', { max: 200 }) : existing.location || '',
    notes: has('notes') ? v.str(b.notes, 'notes', { max: 500 }) : existing.notes || '',
    date: has('date') || !existing.date ? v.date(b.date, 'date', true) : existing.date,
    time: has('time') || !existing.time ? v.time(b.time) : existing.time,
  };
}

module.exports = function careRoutes({ store, auth }) {
  const r = express.Router();
  const save = (req) => store.saveProfile(req.profile);

  // ---- One round-trip dashboard for the Today screen ----
  r.get('/api/dashboard', auth, (req, res) => {
    const now = localParts();
    const p = req.profile;
    res.json({
      now,
      schedule: scheduleFor(p, now.date, now),
      insights: insights(p, now),
      risk: riskForecast(p, now),
      adherence: adherence(p, 7, now),
      nextAppointment: p.appointments.filter((a) => a.date > now.date || (a.date === now.date && a.time >= now.time))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0] || null,
    });
  });

  r.get('/api/schedule', auth, (req, res) => {
    const date = v.date(req.query.date, 'date') || localParts().date;
    res.json({ date, items: scheduleFor(req.profile, date) });
  });
  r.get('/api/adherence', auth, (req, res) => {
    const days = v.int(req.query.days, 'days', { min: 1, max: 90 }) || 7;
    res.json(adherence(req.profile, days));
  });
  /** Dose grid (days x time slots) for the heatmap. */
  r.get('/api/history', auth, (req, res) => {
    const days = v.int(req.query.days, 'days', { min: 1, max: 60 }) || 14;
    const now = localParts();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(now.date, -i);
      out.push({ date, items: scheduleFor(req.profile, date, now).map(({ medId, name, time, status }) => ({ medId, name, time, status })) });
    }
    res.json(out);
  });
  r.get('/api/insights', auth, (req, res) => res.json(insights(req.profile)));
  r.get('/api/risk', auth, (req, res) => res.json(riskForecast(req.profile)));
  r.get('/api/activity', auth, (req, res) => res.json(req.profile.activity.slice(0, 60)));

  // ---- Medications ----
  r.get('/api/medications', auth, (req, res) => res.json(req.profile.medications.map(withDays)));

  r.post('/api/medications', auth, wrap(async (req, res) => {
    const now = localParts();
    const med = { id: newId(), createdDate: now.date, createdTime: now.time, ...medFromBody(req.body || {}) };
    req.profile.medications.push(med);
    logActivity(req.profile, req.member, 'actMedAdd', { med: med.name, times: med.times.join(', ') });
    await save(req);
    res.status(201).json(withDays(med));
  }));

  r.put('/api/medications/:id', auth, wrap(async (req, res) => {
    const list = req.profile.medications;
    const idx = list.findIndex((m) => m.id === req.params.id);
    if (idx < 0) throw new AppError('medNotFound', {}, 404);
    list[idx] = medFromBody(req.body || {}, list[idx]);
    logActivity(req.profile, req.member, 'actMedEdit', { med: list[idx].name });
    await save(req);
    res.json(withDays(list[idx]));
  }));

  r.delete('/api/medications/:id', auth, wrap(async (req, res) => {
    const p = req.profile;
    const med = p.medications.find((m) => m.id === req.params.id);
    if (!med) throw new AppError('medNotFound', {}, 404);
    p.medications = p.medications.filter((m) => m !== med);
    p.doses = p.doses.filter((d) => d.medId !== med.id);
    logActivity(p, req.member, 'actMedRemove', { med: med.name });
    await save(req);
    res.status(204).end();
  }));

  // ---- Dose events (taken / skipped / undo) ----
  r.post('/api/doses', auth, wrap(async (req, res) => {
    const b = req.body || {}; const p = req.profile;
    const med = p.medications.find((m) => m.id === b.medId);
    if (!med) throw new AppError('medNotFound', {}, 404);
    const date = v.date(b.date, 'date', true);
    const time = v.time(b.time);
    if (!med.times.includes(time)) throw new AppError('timeNotInSchedule');
    if (date > localParts().date) throw new AppError('futureDose');
    if (!['taken', 'skipped', 'undo'].includes(b.status)) throw new AppError('invalidStatus');
    const tracksStock = med.stock !== null && med.stock !== undefined;
    const prev = p.doses.find((d) => d.medId === med.id && d.date === date && d.time === time);
    if (prev && prev.status === 'taken' && tracksStock) med.stock += 1;
    p.doses = p.doses.filter((d) => d !== prev);
    if (b.status !== 'undo') {
      p.doses.push({ medId: med.id, date, time, status: b.status, by: req.member.name, at: new Date().toISOString() });
      if (b.status === 'taken' && tracksStock) med.stock = Math.max(0, med.stock - 1);
    }
    // Keep at most ~120 days of dose history per profile to bound document size.
    const cutoff = addDays(localParts().date, -120);
    p.doses = p.doses.filter((d) => d.date >= cutoff);
    logActivity(p, req.member, 'actDose', { status: b.status, med: med.name, date, time });
    await save(req);
    res.json({ items: scheduleFor(p, date), stock: med.stock });
  }));

  // ---- Appointments ----
  r.get('/api/appointments', auth, (req, res) => {
    res.json([...req.profile.appointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
  });

  r.post('/api/appointments', auth, wrap(async (req, res) => {
    const a = { id: newId(), ...apptFromBody(req.body || {}) };
    req.profile.appointments.push(a);
    logActivity(req.profile, req.member, 'actApptAdd', { doctor: a.doctor, date: a.date, time: a.time });
    await save(req);
    res.status(201).json(a);
  }));

  r.put('/api/appointments/:id', auth, wrap(async (req, res) => {
    const list = req.profile.appointments;
    const idx = list.findIndex((a) => a.id === req.params.id);
    if (idx < 0) throw new AppError('apptNotFound', {}, 404);
    list[idx] = apptFromBody(req.body || {}, list[idx]);
    logActivity(req.profile, req.member, 'actApptEdit', { doctor: list[idx].doctor });
    await save(req);
    res.json(list[idx]);
  }));

  r.delete('/api/appointments/:id', auth, wrap(async (req, res) => {
    const p = req.profile;
    const a = p.appointments.find((x) => x.id === req.params.id);
    if (!a) throw new AppError('apptNotFound', {}, 404);
    p.appointments = p.appointments.filter((x) => x !== a);
    logActivity(p, req.member, 'actApptRemove', { doctor: a.doctor });
    await save(req);
    res.status(204).end();
  }));

  return r;
};
