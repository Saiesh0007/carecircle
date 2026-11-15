'use strict';
/** Input validation helpers. Errors carry an i18n key + params so the API can answer in English or Hindi. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const ROLES = ['elder', 'caretaker', 'family'];

class AppError extends Error {
  constructor(key, params = {}, status = 400) {
    super(key);
    this.key = key;
    this.params = params;
    this.status = status;
  }
}
const fail = (key, params, status) => {
  throw new AppError(key, params, status);
};

/** Trimmed string with a maximum length; '' when optional and missing. */
function str(v, field, { required = false, max = 200 } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) {
      fail('required', { field });
    }
    return '';
  }
  if (typeof v !== 'string') {
    fail('mustBeText', { field });
  }
  const out = v.trim();
  if (required && !out) {
    fail('required', { field });
  }
  if (out.length > max) {
    fail('tooLong', { field, max });
  }
  return out;
}
/** Lower-cased email address, or '' when optional and missing. */
function email(v, field = 'email', required = false) {
  const e = str(v, field, { required, max: 254 }).toLowerCase();
  if (e && !EMAIL_RE.test(e)) {
    fail('invalidEmail', { field });
  }
  return e;
}
/** 24-hour HH:MM time. */
function time(v, field = 'time') {
  const s = String(v ?? '').trim();
  if (!TIME_RE.test(s)) {
    fail('invalidTime', { field });
  }
  return s;
}
/** 1-8 unique HH:MM times, sorted. */
function times(v) {
  if (!Array.isArray(v) || v.length === 0 || v.length > 8) {
    fail('invalidTimes');
  }
  const out = [...new Set(v.map((x) => String(x).trim()))];
  if (!out.every((x) => TIME_RE.test(x))) {
    fail('invalidTimes');
  }
  return out.sort();
}
/** Rejects impossible dates such as 2026-02-30 (which JS would silently roll over). */
function isRealDate(d) {
  const parsed = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
}
/** Real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-30), or '' when optional. */
function date(v, field, required = false) {
  const d = str(v, field, { required, max: 10 });
  if (d && (!DATE_RE.test(d) || !isRealDate(d))) {
    fail('invalidDate', { field });
  }
  return d;
}
/** Integer within [min, max], or null when empty. */
function int(v, field, { min = 0, max = 100000 } = {}) {
  if (v === undefined || v === null || v === '') {
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    fail('wholeNumber', { field, min, max });
  }
  return n;
}
/** Shared circle passcode: 6-64 characters. */
function passcode(v) {
  const p = str(v, 'passcode', { required: true, max: 64 });
  if (p.length < 6) {
    fail('passcodeShort');
  }
  return p;
}
/** One of ROLES (elder, caretaker, family). */
function role(v) {
  if (!ROLES.includes(v)) {
    fail('invalidRole');
  }
  return v;
}

module.exports = {
  AppError,
  fail,
  str,
  email,
  time,
  times,
  date,
  int,
  passcode,
  role,
  TIME_RE,
  DATE_RE,
  ROLES,
};
