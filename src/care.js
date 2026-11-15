'use strict';
const { localParts, toMinutes, addDays } = require('./time');

const MISSED_GRACE_MIN = Number(process.env.MISSED_GRACE_MIN || 30);
const UPCOMING_LEAD_MIN = Number(process.env.UPCOMING_LEAD_MIN || 15);
const LOW_STOCK_DAYS = 3;

function isActiveOn(med, date) {
  if (med.active === false) return false;
  if (med.startDate && date < med.startDate) return false;
  if (med.endDate && date > med.endDate) return false;
  return true;
}

/** Build the dose schedule for one day, merged with recorded dose events. */
function scheduleFor(profile, date, now = localParts()) {
  const index = new Map(profile.doses.filter((d) => d.date === date).map((d) => [`${d.medId}|${d.time}`, d]));
  const items = [];
  for (const med of profile.medications) {
    if (!isActiveOn(med, date)) continue;
    if (med.createdDate && date < med.createdDate) continue;
    for (const time of med.times) {
      if (med.createdDate === date && med.createdTime && time < med.createdTime) continue;
      const rec = index.get(`${med.id}|${time}`);
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

const FINAL = ['taken', 'missed', 'skipped'];

/** Adherence over the last N days (only doses that are already decided count). */
function adherence(profile, days = 7, now = localParts()) {
  const daily = [];
  const perMedMap = new Map(profile.medications.map((m) => [m.id, { medId: m.id, name: m.name, taken: 0, total: 0 }]));
  let taken = 0; let total = 0;
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(now.date, -i);
    const sched = scheduleFor(profile, date, now).filter((s) => FINAL.includes(s.status));
    const t = sched.filter((s) => s.status === 'taken').length;
    for (const s of sched) {
      const pm = perMedMap.get(s.medId);
      pm.total++; if (s.status === 'taken') pm.taken++;
    }
    daily.push({ date, taken: t, total: sched.length, rate: sched.length ? Math.round((t / sched.length) * 100) : null });
    taken += t; total += sched.length;
  }
  const perMed = [...perMedMap.values()].map((m) => ({ medId: m.medId, name: m.name, rate: m.total ? Math.round((m.taken / m.total) * 100) : null }));
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i];
    if (d.total === 0) continue;
    if (d.taken === d.total) streak++; else break;
  }
  return { days, taken, total, rate: total ? Math.round((taken / total) * 100) : null, daily, perMed, streak };
}

function daysOfStockLeft(med) {
  if (med.stock === null || med.stock === undefined) return null;
  const perDay = med.times.length;
  return perDay ? Math.floor(med.stock / perDay) : null;
}

/** Smart insights: low stock, frequently missed time slots, appointments soon. */
function insights(profile, now = localParts()) {
  const out = [];
  for (const med of profile.medications.filter((m) => m.active !== false)) {
    const left = daysOfStockLeft(med);
    if (left !== null && left <= LOW_STOCK_DAYS) out.push({ level: 'warning', type: 'refill', text: `${med.name}: only about ${left} day(s) of stock left. Arrange a refill.` });
  }
  const missedByTime = {};
  for (let i = 1; i <= 14; i++) {
    for (const s of scheduleFor(profile, addDays(now.date, -i), now)) {
      if (s.status === 'missed') missedByTime[s.time] = (missedByTime[s.time] || 0) + 1;
    }
  }
  for (const [time, n] of Object.entries(missedByTime)) {
    if (n >= 3) out.push({ level: 'info', type: 'pattern', text: `Doses at ${time} were missed ${n} times in the last 2 weeks. Consider moving them to a time that fits the daily routine better.` });
  }
  const soon = profile.appointments.filter((a) => a.date >= now.date && a.date <= addDays(now.date, 2));
  for (const a of soon) out.push({ level: 'info', type: 'appointment', text: `Upcoming: ${a.doctor} on ${a.date} at ${a.time}${a.location ? ` (${a.location})` : ''}.` });
  return out;
}

module.exports = { scheduleFor, adherence, insights, daysOfStockLeft, isActiveOn, MISSED_GRACE_MIN, UPCOMING_LEAD_MIN };
