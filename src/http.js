'use strict';
/** Shared HTTP helpers: security headers, auth middleware, error handling, serializers. */
const crypto = require('crypto');
const { verifyToken, sign } = require('./auth');
const { AppError } = require('./validate');
const i18n = require('./i18n');
const { daysOfStockLeft } = require('./care');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function securityHeaders(req, res, next) {
  res.set(SECURITY_HEADERS);
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
}

/** Resolve the UI language from the x-lang header (set by the web app). */
function language(req, res, next) {
  req.lang = i18n.normLang(req.get('x-lang'));
  next();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Loads the signed-in member and their care profile, or answers 401. */
function requireAuth(store) {
  return wrap(async (req, res, next) => {
    const header = req.get('authorization') || '';
    const payload = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!payload) throw new AppError('sessionInvalid', {}, 401);
    const profile = await store.getProfile(payload.pid);
    const member = profile && profile.members.find((m) => m.id === payload.mid);
    if (!member || payload.ver !== profile.passcodeVersion) throw new AppError('sessionInvalid', {}, 401);
    req.profile = profile;
    req.member = member;
    next();
  });
}

function issueSession(profile, member) {
  return { token: sign({ pid: profile.id, mid: member.id, ver: profile.passcodeVersion }), profileId: profile.id, member };
}

/** Append to the activity feed. Stored as i18n key + params so each viewer reads it in their language. */
function logActivity(profile, member, key, params = {}) {
  profile.activity.unshift({ at: new Date().toISOString(), by: `${member.name} (${member.role})`, key, params });
  if (profile.activity.length > 200) profile.activity.length = 200;
}

/** Never send secrets or bulk history to the browser. */
function publicProfile(p) {
  const { passcodeHash, doses, activity, ...rest } = p;
  return {
    ...rest,
    medications: p.medications.map((m) => ({ ...m, daysLeft: daysOfStockLeft(m) })),
    appointments: [...p.appointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
  };
}

const newId = () => crypto.randomBytes(8).toString('hex');
const newCareCode = () => `CC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function errorHandler(err, req, res, next) {
  const lang = req.lang || 'en';
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: i18n.t(lang, 'invalidJson'), code: 'invalidJson' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: i18n.t(lang, 'invalidJson'), code: 'tooLarge' });
  if (err instanceof AppError) return res.status(err.status).json({ error: i18n.t(lang, err.key, err.params), code: err.key });
  console.error(err);
  return res.status(500).json({ error: i18n.t(lang, 'serverError'), code: 'serverError' });
}

module.exports = {
  SECURITY_HEADERS, securityHeaders, language, wrap, requireAuth, issueSession, logActivity,
  publicProfile, newId, newCareCode, safeEqual, errorHandler,
};
