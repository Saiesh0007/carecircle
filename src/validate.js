'use strict';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const ROLES = ['elder', 'caretaker', 'family'];

class ValidationError extends Error { constructor(m) { super(m); this.status = 400; } }

function str(v, field, { required = false, max = 200 } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(`${field} is required`);
    return '';
  }
  if (typeof v !== 'string') throw new ValidationError(`${field} must be text`);
  const t = v.trim();
  if (required && !t) throw new ValidationError(`${field} is required`);
  if (t.length > max) throw new ValidationError(`${field} is too long (max ${max})`);
  return t;
}
function email(v, field = 'email', required = false) {
  const e = str(v, field, { required, max: 254 }).toLowerCase();
  if (e && !EMAIL_RE.test(e)) throw new ValidationError(`${field} is not a valid email`);
  return e;
}
function times(v) {
  if (!Array.isArray(v) || v.length === 0 || v.length > 8) throw new ValidationError('times must list 1-8 HH:MM values');
  const out = [...new Set(v.map((t) => String(t).trim()))];
  out.forEach((t) => { if (!TIME_RE.test(t)) throw new ValidationError(`invalid time ${t}`); });
  return out.sort();
}
function date(v, field, required = false) {
  const d = str(v, field, { required, max: 10 });
  if (d && !DATE_RE.test(d)) throw new ValidationError(`${field} must be YYYY-MM-DD`);
  return d;
}
function int(v, field, { min = 0, max = 100000 } = {}) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${field} must be a whole number ${min}-${max}`);
  return n;
}
function passcode(v) {
  const p = str(v, 'passcode', { required: true, max: 64 });
  if (p.length < 6) throw new ValidationError('passcode must be at least 6 characters');
  return p;
}
function role(v) {
  if (!ROLES.includes(v)) throw new ValidationError(`role must be one of ${ROLES.join(', ')}`);
  return v;
}
module.exports = { ValidationError, str, email, times, date, int, passcode, role, TIME_RE, DATE_RE, ROLES };
