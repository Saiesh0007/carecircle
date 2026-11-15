'use strict';
/**
 * Pure care logic: daily schedule, adherence statistics, insights and the
 * missed-dose risk model. No I/O, so everything here is unit-testable.
 */
const { localParts, toMinutes, addDays, weekday } = require('./time');

const MISSED_GRACE_MIN = Number(process.env.MISSED_GRACE_MIN || 30);
const UPCOMING_LEAD_MIN = Number(process.env.UPCOMING_LEAD_MIN || 15);
const LOW_STOCK_DAYS = 3;
const FINAL = new Set(['taken', 'missed', 'skipped']);

function isActiveOn(med, date) {
  if (med.active === false) return false;
  if (med.startDate && date < med.startDate) return false;
  if (med.endDate && date > med.endDate) return false;
  if (med.createdDate && date < med.createdDate) return false;
  return true;
}

/** Index dose records by "date|medId|time" once, so multi-day scans stay O(days x slots). */
function doseIndex(profile) {
  const idx = new Map();
  for (const d of profile.doses) idx.set(`${d.date}|${d.medId}|${d.time}`, d);
  return idx;
}

/** Dose schedule for one day merged with recorded events. */
function scheduleFor(profile, date, now = localParts(), idx = doseIndex(profile)) {
  const items = [];
  for (const med of profile.medications) {
    if (!isActiveOn(med, date)) continue;
    for (const time of med.times) {
      // A medicine added at 16:00 today should not report this morning's slot as missed.
      if (med.createdDate === date && med.createdTime && time < med.createdTime) continue;
      const rec = idx.get(`${date}|${med.id}|${time}`);
      let status = rec ? rec.status : 'pending';
      if (!rec) {
        const overdue = date < now.date || (date === now.date && now.minutes > toMinutes(time) + MISSED_GRACE_MIN);
        if (overdue) status = 'missed';
        else if (date === now.date && now.minutes >= toMinutes(time)) status = 'due';
      }
      items.push({
        medId: med.id, name: med.name, dosage: med.dosage, instructions: med.instructions,
        date, time, status, recordedBy: rec ? rec.by : null, recordedAt: rec ? rec.at : null,
      });
    }
  }
  return items.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

/** Decided doses (taken/missed/skipped) over the last `days` days, oldest first. */
function history(profile, days, now = localParts()) {
  const idx = doseIndex(profile);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(now.date, -i);
    out.push({ date, items: scheduleFor(profile, date, now, idx).filter((s) => FINAL.has(s.status)) });
  }
  return out;
}

function adherence(profile, days = 7, now = localParts()) {
  const perMed = new Map(profile.medications.map((m) => [m.id, { medId: m.id, name: m.name, taken: 0, total: 0 }]));
  const daily = [];
  let taken = 0; let total = 0;
  for (const { date, items } of history(profile, days, now)) {
    const t = items.filter((s) => s.status === 'taken').length;
    for (const s of items) {
      const pm = perMed.get(s.medId);
      pm.total += 1; if (s.status === 'taken') pm.taken += 1;
    }
    daily.push({ date, taken: t, total: items.length, rate: items.length ? Math.round((t / items.length) * 100) : null });
    taken += t; total += items.length;
  }
  // Streak of perfect days. Today only counts once it is perfect so far; an imperfect
  // (still running) today does not break the streak earned on previous days.
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i];
    if (d.total === 0) continue;
    if (d.taken === d.total) streak += 1;
    else if (i === daily.length - 1) continue;
    else break;
  }
  return {
    days, taken, total, streak, daily,
    rate: total ? Math.round((taken / total) * 100) : null,
    perMed: [...perMed.values()].map((m) => ({ medId: m.medId, name: m.name, rate: m.total ? Math.round((m.taken / m.total) * 100) : null })),
  };
}

function daysOfStockLeft(med) {
  if (med.stock === null || med.stock === undefined || !med.times.length) return null;
  return Math.floor(med.stock / med.times.length);
}

/**
 * Missed-dose risk model.
 * For every remaining dose today we estimate P(miss) with a Bayesian, recency-weighted
 * miss rate (Beta prior, exponential decay with a 7-day half-life) learned from three
 * signals: the exact medicine+slot, the time-of-day slot across medicines, and the same
 * weekday. The signals are blended by how much evidence each has. Returns 0-100 scores.
 */
const HALF_LIFE_DAYS = 7;
const PRIOR = { a: 0.5, b: 4.5 }; // weak prior: ~10% of doses are missed, worth 5 observations

function weightedRate(events) {
  let miss = PRIOR.a; let all = PRIOR.a + PRIOR.b; let evidence = 0;
  for (const e of events) {
    const w = 0.5 ** (e.age / HALF_LIFE_DAYS);
    all += w; evidence += w;
    if (e.missed) miss += w;
  }
  return { rate: miss / all, evidence };
}

function riskForecast(profile, now = localParts(), lookbackDays = 28) {
  const past = history(profile, lookbackDays + 1, now).slice(0, -1); // exclude today
  const events = [];
  past.forEach(({ date, items }, i) => {
    const age = past.length - i;
    const wd = weekday(date);
    for (const s of items) {
      events.push({ medId: s.medId, time: s.time, hour: s.time.slice(0, 2), wd, age, missed: s.status === 'missed' });
    }
  });
  const todayWd = weekday(now.date);
  const upcoming = scheduleFor(profile, now.date, now).filter((s) => s.status === 'pending' || s.status === 'due');
  return upcoming.map((s) => {
    const slot = weightedRate(events.filter((e) => e.medId === s.medId && e.time === s.time));
    const hour = weightedRate(events.filter((e) => e.hour === s.time.slice(0, 2)));
    const day = weightedRate(events.filter((e) => e.wd === todayWd));
    const ws = 1 + slot.evidence; const wh = 0.5 + hour.evidence * 0.5; const wd = 0.25 + day.evidence * 0.25;
    const p = (slot.rate * ws + hour.rate * wh + day.rate * wd) / (ws + wh + wd);
    const risk = Math.round(p * 100);
    const reasons = [];
    if (slot.rate >= 0.25 && slot.evidence >= 2) reasons.push({ key: 'riskSlot', params: { pct: Math.round(slot.rate * 100) } });
    if (hour.rate >= 0.25 && hour.evidence >= 2) reasons.push({ key: 'riskHour', params: { hour: s.time.slice(0, 2) } });
    if (day.rate >= 0.25 && day.evidence >= 1) reasons.push({ key: 'riskWeekday' });
    return {
      medId: s.medId, name: s.name, time: s.time, risk,
      level: risk >= 35 ? 'high' : risk >= 18 ? 'medium' : 'low',
      reasons,
    };
  }).sort((a, b) => b.risk - a.risk);
}

/** Actionable insights. Returned as i18n keys + params; the client renders them in the chosen language. */
function insights(profile, now = localParts()) {
  const out = [];
  for (const med of profile.medications.filter((m) => m.active !== false)) {
    const left = daysOfStockLeft(med);
    if (left !== null && left <= LOW_STOCK_DAYS) out.push({ level: 'warning', type: 'refill', key: 'insRefill', params: { med: med.name, days: left } });
  }
  const missedByTime = {};
  for (const { items } of history(profile, 15, now).slice(0, -1)) {
    for (const s of items) if (s.status === 'missed') missedByTime[s.time] = (missedByTime[s.time] || 0) + 1;
  }
  for (const [time, n] of Object.entries(missedByTime)) {
    if (n >= 3) out.push({ level: 'info', type: 'pattern', key: 'insPattern', params: { time, count: n } });
  }
  for (const a of profile.appointments) {
    if (a.date >= now.date && a.date <= addDays(now.date, 2)) {
      out.push({ level: 'info', type: 'appointment', key: 'insAppt', params: { doctor: a.doctor, date: a.date, time: a.time } });
    }
  }
  return out;
}

module.exports = {
  scheduleFor, adherence, insights, riskForecast, daysOfStockLeft, isActiveOn, history,
  MISSED_GRACE_MIN, UPCOMING_LEAD_MIN,
};
