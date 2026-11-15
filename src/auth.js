'use strict';
/** Passcode hashing (scrypt), HMAC-signed tokens, cookies and a small rate limiter. */
const crypto = require('crypto');
const { AppError } = require('./validate');

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DAY = 24 * 60 * 60 * 1000;

/** Salted scrypt hash, stored as `salt:hash` (hex). */
function hashPasscode(passcode, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(passcode), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
/** Constant-time check of a passcode against a stored `salt:hash`. */
function verifyPasscode(passcode, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) {
    return false;
  }
  const candidate = crypto.scryptSync(String(passcode), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

const hmac = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');

/** Sign a payload. `purpose` prevents a token minted for one use (e.g. OAuth state) being replayed as another. */
function sign(payload, { ttlMs = DAY / 2, purpose = 'session' } = {}) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, p: purpose, exp: Date.now() + ttlMs }),
  ).toString('base64url');
  return `${body}.${hmac(body)}`;
}
/**
 * Verify an HMAC-signed token and its purpose binding.
 * @returns {object|null} the payload, or null if tampered, expired or issued for another purpose
 */
function verifyToken(token, purpose = 'session') {
  if (typeof token !== 'string') {
    return null;
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() && payload.p === purpose ? payload : null;
  } catch {
    return null;
  }
}

/** Parse a Cookie header into a name -> decoded value map. */
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return out;
}
/** Serialize an HttpOnly, SameSite=Lax cookie (Secure in production). */
function cookie(name, value, { maxAgeS, secure }) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure ? '; Secure' : ''}`;
}

/**
 * Fixed-window in-memory limiter. On serverless each instance has its own window,
 * which still bounds brute force per instance; passcodes are also scrypt-hashed (slow).
 */
function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    const entry = hits.get(k);
    if (!entry || now - entry.start > windowMs) {
      hits.set(k, { start: now, count: 1 });
      if (hits.size > 5000) {
        for (const [hk, hv] of hits) {
          if (now - hv.start > windowMs) {
            hits.delete(hk);
          }
        }
      }
      return next();
    }
    if (++entry.count > max) {
      return next(new AppError('tooMany', {}, 429));
    }
    next();
  };
}

module.exports = {
  hashPasscode,
  verifyPasscode,
  sign,
  verifyToken,
  parseCookies,
  cookie,
  rateLimit,
};
