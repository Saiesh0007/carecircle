'use strict';
/**
 * Email reminders. collectReminders() decides WHAT is due (pure, testable);
 * runReminders() sends each one once (deduplicated through the store).
 * Every member receives the email in their own preferred language.
 */
const nodemailer = require('nodemailer');
const { localParts, toMinutes, addDays } = require('./time');
const { scheduleFor, daysOfStockLeft, UPCOMING_LEAD_MIN } = require('./care');
const i18n = require('./i18n');

/** SMTP when configured; otherwise "dry-run": messages are stored in the in-app outbox. */
function createMailer({ store, env = process.env } = {}) {
  if (env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === 'true',
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    return {
      mode: 'smtp',
      async send(msg, profileId) {
        await transport.sendMail({
          from: env.MAIL_FROM || env.SMTP_USER,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
        });
        if (store && profileId) {
          await store.pushOutbox(profileId, {
            ...msg,
            at: new Date().toISOString(),
            delivered: true,
          });
        }
      },
    };
  }
  return {
    mode: 'dry-run',
    async send(msg, profileId) {
      if (store && profileId) {
        await store.pushOutbox(profileId, {
          ...msg,
          at: new Date().toISOString(),
          delivered: false,
        });
      }
    },
  };
}

const EVERYONE = ['elder', 'caretaker', 'family'];
const CARERS = ['caretaker', 'family'];

/** Members with an email who have not opted out and whose role is in `roles`. */
function recipients(profile, roles) {
  return profile.members.filter((m) => m.email && m.notify !== false && roles.includes(m.role));
}

/**
 * Build one localized email per opted-in recipient for a reminder.
 * @param {object} profile care circle
 * @param {{ roles: string[], key: string, kind: string, params: object }} reminder
 *   `key` is the de-duplication base; `kind` selects the `<kind>Subject` / `<kind>Body` templates.
 */
function compose(profile, { roles, key: keyBase, kind, params }) {
  const subjectKey = `${kind}Subject`;
  const bodyKey = `${kind}Body`;
  return recipients(profile, roles).map((m) => {
    const lang = i18n.normLang(m.lang);
    const p = {
      name: profile.name,
      ...params,
      dosage: params.dosage || i18n.email(lang, 'asPrescribed'),
      location: params.location || i18n.email(lang, 'na'),
      notes: params.notes || i18n.email(lang, 'na'),
      instructions: params.instructions
        ? i18n.email(lang, 'instructionsLine', { text: params.instructions })
        : '',
    };
    return {
      key: `${keyBase}|${m.id}`,
      msg: {
        to: m.email,
        subject: i18n.email(lang, subjectKey, p),
        text: i18n.email(lang, bodyKey, p) + i18n.email(lang, 'footer', p),
        kind: subjectKey.replace('Subject', ''),
      },
    };
  });
}

/** Everything that should be emailed right now for one profile (before de-duplication). */
function dueReminders(profile, now = localParts()) {
  const out = [];
  for (const s of scheduleFor(profile, now.date, now)) {
    const diff = toMinutes(s.time) - now.minutes;
    const params = { med: s.name, time: s.time, dosage: s.dosage, instructions: s.instructions };
    if (s.status === 'pending' && diff >= 0 && diff <= UPCOMING_LEAD_MIN) {
      out.push(
        ...compose(profile, {
          roles: EVERYONE,
          key: `up|${profile.id}|${s.medId}|${s.date}|${s.time}`,
          kind: 'upcoming',
          params,
        }),
      );
    }
    if (s.status === 'missed') {
      out.push(
        ...compose(profile, {
          roles: EVERYONE,
          key: `miss|${profile.id}|${s.medId}|${s.date}|${s.time}`,
          kind: 'missed',
          params,
        }),
      );
    }
  }
  for (const a of profile.appointments) {
    const params = {
      doctor: a.doctor,
      time: a.time,
      date: a.date,
      location: a.location,
      notes: a.notes,
    };
    if (a.date === addDays(now.date, 1)) {
      out.push(
        ...compose(profile, {
          roles: EVERYONE,
          key: `appt1d|${profile.id}|${a.id}|${a.date}`,
          kind: 'apptTomorrow',
          params,
        }),
      );
    }
    if (a.date === now.date) {
      const diff = toMinutes(a.time) - now.minutes;
      if (diff >= 0 && diff <= 120) {
        out.push(
          ...compose(profile, {
            roles: EVERYONE,
            key: `appt2h|${profile.id}|${a.id}|${a.date}`,
            kind: 'apptSoon',
            params,
          }),
        );
      }
    }
  }
  for (const m of profile.medications.filter((x) => x.active !== false)) {
    const days = daysOfStockLeft(m);
    if (days !== null && days <= 3) {
      out.push(
        ...compose(profile, {
          roles: CARERS,
          key: `stock|${profile.id}|${m.id}|${now.date}`,
          kind: 'refill',
          params: { med: m.name, days, stock: m.stock },
        }),
      );
    }
  }
  return out;
}

/** Due reminders for a profile that have not been sent yet. */
async function collectReminders(profile, store, now = localParts()) {
  const due = dueReminders(profile, now);
  const sent = await Promise.all(due.map((r) => store.wasSent(r.key)));
  return due.filter((_, i) => !sent[i]);
}

/**
 * Send every unsent due reminder for one circle. A reminder is marked sent only after the
 * transport succeeds, so failures are retried on the next tick. Demo circles never use SMTP.
 * @returns {Promise<number>} emails sent
 */
async function remindProfile(profile, store, mailer, now = localParts()) {
  // Demo circles use example.com addresses: never send real mail for them.
  const sender = profile.demo && mailer.mode === 'smtp' ? createMailer({ store, env: {} }) : mailer;
  let sent = 0;
  for (const r of await collectReminders(profile, store, now)) {
    try {
      await sender.send(r.msg, profile.id);
      await store.markSent(r.key);
      sent += 1;
    } catch (e) {
      console.error('email failed:', e.message);
    }
  }
  return sent;
}

/** One reminder tick across every stored circle. @returns {Promise<number>} emails sent */
async function runReminders(store, mailer, now = localParts()) {
  let sent = 0;
  for (const id of await store.listProfileIds()) {
    const profile = await store.getProfile(id);
    if (profile) {
      sent += await remindProfile(profile, store, mailer, now);
    }
  }
  return sent;
}

module.exports = {
  createMailer,
  dueReminders,
  collectReminders,
  remindProfile,
  runReminders,
  recipients,
};
