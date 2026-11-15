'use strict';
/** Time helpers. All care schedules are evaluated in one configurable time zone. */
const TZ = process.env.TZ_REGION || 'Asia/Kolkata';

const fmtCache = new Map();
/** Cached Intl formatter for a time zone (creating one is comparatively expensive). */
function formatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(
      tz,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    );
  }
  return fmtCache.get(tz);
}

/** {date:'YYYY-MM-DD', time:'HH:MM', minutes} for an instant in the care time zone. */
function localParts(d = new Date(), tz = TZ) {
  const p = Object.fromEntries(
    formatter(tz)
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Add `n` calendar days to an ISO date (YYYY-MM-DD), in UTC so DST never shifts it. */
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

module.exports = { TZ, localParts, toMinutes, addDays, weekday };
