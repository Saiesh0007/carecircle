'use strict';
/** AI endpoints (Groq) and reminder endpoints. */
const express = require('express');
const v = require('../validate');
const { AppError } = require('../validate');
const { rateLimit } = require('../auth');
const { wrap, safeEqual } = require('../http');
const { remindProfile, runReminders, recipients } = require('../reminders');
const i18n = require('../i18n');

module.exports = function assistantRoutes({ store, mailer, ai, auth }) {
  const r = express.Router();
  // Per-member budget keeps usage inside Groq's free tier.
  const aiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: Number(process.env.AI_RATE_MAX || 40),
    key: (req) => `${req.profile.id}:${req.member.id}`,
  });
  const requireAI = (req, res, next) =>
    ai.enabled ? next() : next(new AppError('aiUnavailable', {}, 503));

  r.post(
    '/api/ai/chat',
    auth,
    requireAI,
    aiLimiter,
    wrap(async (req, res) => {
      const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-10) : [];
      const messages = raw
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            m.content.trim(),
        )
        .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1500) }));
      if (!messages.length || messages[messages.length - 1].role !== 'user') {
        throw new AppError('required', { field: 'message' });
      }
      res.json(
        await ai.assistant({ profile: req.profile, member: req.member, messages, lang: req.lang }),
      );
    }),
  );

  r.post(
    '/api/ai/parse',
    auth,
    requireAI,
    aiLimiter,
    wrap(async (req, res) => {
      const text = v.str(req.body?.text, 'text', { required: true, max: 3000 });
      res.json(await ai.parsePrescription({ text, lang: req.lang }));
    }),
  );

  r.post(
    '/api/ai/interactions',
    auth,
    requireAI,
    aiLimiter,
    wrap(async (req, res) => {
      res.json(await ai.checkInteractions({ profile: req.profile, lang: req.lang }));
    }),
  );

  r.post(
    '/api/ai/summary',
    auth,
    requireAI,
    aiLimiter,
    wrap(async (req, res) => {
      const summary = await ai.careSummary({ profile: req.profile, lang: req.lang });
      let emailed = 0;
      if (req.body?.share === true) {
        const text = [
          summary.headline,
          '',
          summary.summary,
          '',
          ...summary.wins.map((w) => `+ ${w}`),
          ...summary.concerns.map((c) => `! ${c}`),
          ...summary.suggestions.map((s) => `- ${s}`),
        ].join('\n');
        for (const m of recipients(req.profile, ['caretaker', 'family', 'elder'])) {
          await mailer.send(
            {
              to: m.email,
              subject: i18n.email(req.lang, 'summarySubject', { name: req.profile.name }),
              text,
              kind: 'summary',
            },
            req.profile.id,
          );
          emailed += 1;
        }
      }
      res.json({ ...summary, emailed });
    }),
  );

  r.post(
    '/api/ai/transcribe',
    auth,
    requireAI,
    aiLimiter,
    express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '4mb' }),
    wrap(async (req, res) => {
      const mime = String(req.get('content-type') || 'audio/webm').split(';')[0];
      res.json(
        await ai.transcribe({
          audio: Buffer.isBuffer(req.body) ? req.body : null,
          mime,
          lang: req.lang,
        }),
      );
    }),
  );

  // ---- Reminders ----
  r.get(
    '/api/reminders/outbox',
    auth,
    wrap(async (req, res) => {
      res.json({ mode: mailer.mode, messages: await store.getOutbox(req.profile.id) });
    }),
  );

  r.post(
    '/api/reminders/run',
    auth,
    wrap(async (req, res) => {
      res.json({ sent: await remindProfile(req.profile, store, mailer) });
    }),
  );

  // Scheduler hook (GitHub Actions / Vercel Cron / Cloud Scheduler). Requires CRON_SECRET.
  const tick = wrap(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const given =
      req.get('x-cron-secret') || (req.get('authorization') || '').replace(/^Bearer /, '');
    if (!secret || !given || !safeEqual(given, secret)) {
      throw new AppError('forbidden', {}, 403);
    }
    res.json({ sent: await runReminders(store, mailer) });
  });
  r.get('/internal/reminders/tick', tick);
  r.post('/internal/reminders/tick', tick);

  return r;
};
