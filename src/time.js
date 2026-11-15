'use strict';
const TZ = process.env.TZ_REGION || 'Asia/Kolkata';

/** Returns {date:'YYYY-MM-DD', time:'HH:MM', minutes} for a Date in the care timezone. */
function localParts(d = new Date(), tz = TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return { date, time, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
function toMinutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
module.exports = { TZ, localParts, toMinutes, addDays };
