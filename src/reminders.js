'use strict';
const nodemailer = require('nodemailer');
const { localParts, toMinutes, addDays } = require('./time');
const { scheduleFor, daysOfStockLeft, UPCOMING_LEAD_MIN } = require('./care');

/** SMTP mailer when configured; otherwise a dry-run outbox that logs (safe default for demos/tests). */
function createMailer() {
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    return { mode: 'smtp', async send(msg) { await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...msg }); } };
  }
  const outbox = [];
  return {
    mode: 'dry-run',
    outbox,
    async send(msg) {
      outbox.push({ ...msg, at: new Date().toISOString() });
      if (outbox.length > 200) outbox.shift();
      console.log(`[email:dry-run] to=${msg.to} subject="${msg.subject}"`);
    },
  };
}

const EVERYONE = ['elder', 'caretaker', 'family'];
const CARERS = ['caretaker', 'family'];

function recipients(profile, roles) {
  return profile.members.filter((m) => m.email && m.notify !== false && roles.includes(m.role)).map((m) => m.email);
}

/** Collect reminder emails due now for one profile, skipping ones already sent. */
function collectReminders(profile, store, now = localParts()) {
  const out = [];
  const push = (key, to, subject, text) => {
    if (!to.length || store.wasSent(key)) return;
    out.push({ key, msg: { to: to.join(','), subject, text } });
  };
  const who = profile.name;

  for (const s of scheduleFor(profile, now.date, now)) {
    const diff = toMinutes(s.time) - now.minutes;
    if (s.status === 'pending' && diff >= 0 && diff <= UPCOMING_LEAD_MIN) {
      push(`up|${profile.id}|${s.medId}|${s.date}|${s.time}`, recipients(profile, EVERYONE),
        `Upcoming dose: ${s.name} at ${s.time}`,
        `Hello,\n\n${who} has a dose of ${s.name} (${s.dosage || 'as prescribed'}) due at ${s.time}.\n${s.instructions ? `Instructions: ${s.instructions}\n` : ''}\nPlease mark it as taken in CareCircle once done.`);
    }
    if (s.status === 'missed') {
      push(`miss|${profile.id}|${s.medId}|${s.date}|${s.time}`, recipients(profile, EVERYONE),
        `Missed dose alert: ${s.name} (${s.time})`,
        `Hello,\n\nThe ${s.time} dose of ${s.name} for ${who} has not been marked as taken.\nPlease check in and record the dose in CareCircle.`);
    }
  }
  for (const a of profile.appointments) {
    if (a.date === addDays(now.date, 1)) {
      push(`appt1d|${profile.id}|${a.id}|${a.date}`, recipients(profile, EVERYONE), `Appointment tomorrow: ${a.doctor} at ${a.time}`,
        `Reminder: ${who} has an appointment with ${a.doctor}${a.specialty ? ` (${a.specialty})` : ''} on ${a.date} at ${a.time}.\nLocation: ${a.location || 'n/a'}\nNotes: ${a.notes || '-'}\n\nPlease arrange transport and bring the current medication list.`);
    }
    if (a.date === now.date) {
      const diff = toMinutes(a.time) - now.minutes;
      if (diff >= 0 && diff <= 120) {
        push(`appt2h|${profile.id}|${a.id}|${a.date}`, recipients(profile, EVERYONE), `Appointment soon: ${a.doctor} at ${a.time}`,
          `${who} has an appointment with ${a.doctor} today at ${a.time}. Location: ${a.location || 'n/a'}.`);
      }
    }
  }
  for (const m of profile.medications.filter((x) => x.active !== false)) {
    const left = daysOfStockLeft(m);
    if (left !== null && left <= 3) {
      push(`stock|${profile.id}|${m.id}|${now.date}`, recipients(profile, CARERS), `Refill needed: ${m.name}`,
        `${m.name} for ${who} has about ${left} day(s) of stock left (${m.stock} units). Please arrange a refill.`);
    }
  }
  return out;
}

async function runReminders(store, mailer, now = localParts()) {
  let sent = 0;
  for (const profile of store.allProfiles()) {
    for (const r of collectReminders(profile, store, now)) {
      try {
        await mailer.send(r.msg);
        store.markSent(r.key);
        sent++;
      } catch (e) { console.error('email failed:', e.message); }
    }
  }
  return sent;
}

module.exports = { createMailer, collectReminders, runReminders, recipients };
