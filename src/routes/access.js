'use strict';
/** Care circles, sign-in (passcode, demo, OAuth), profile and member management. */
const express = require('express');
const v = require('../validate');
const { AppError } = require('../validate');
const { hashPasscode, verifyPasscode, sign, verifyToken, parseCookies, cookie, rateLimit } = require('../auth');
const { wrap, issueSession, logActivity, publicProfile, newId, newCareCode } = require('../http');
const { buildDemoProfile } = require('../demo');
const { remindProfile } = require('../reminders');
const i18n = require('../i18n');

const MIN = 60 * 1000;

module.exports = function accessRoutes({ store, mailer, oauth, ai, auth }) {
  const r = express.Router();
  const authLimiter = rateLimit({ windowMs: 15 * MIN, max: Number(process.env.AUTH_RATE_MAX || 30) });
  const demoLimiter = rateLimit({ windowMs: 60 * MIN, max: Number(process.env.DEMO_RATE_MAX || 20) });
  const lang = (b, req) => i18n.normLang(b.lang || req.lang);

  r.get('/api/config', (req, res) => {
    res.json({ ai: ai.enabled, oauth: oauth.enabled(), emailMode: mailer.mode, storage: store.kind });
  });

  // ---- Create a care circle ----
  r.post('/api/profiles', authLimiter, wrap(async (req, res) => {
    const b = req.body || {};
    const passcode = v.passcode(b.passcode);
    const member = {
      id: newId(),
      name: v.str(b.yourName, 'yourName', { required: true, max: 80 }),
      email: v.email(b.yourEmail, 'yourEmail'),
      role: v.role(b.yourRole || 'caretaker'),
      notify: true,
      lang: lang(b, req),
    };
    const profile = {
      id: newCareCode(),
      name: v.str(b.name, 'name', { required: true, max: 80 }),
      dob: v.date(b.dob, 'dob'),
      conditions: v.str(b.conditions, 'conditions', { max: 500 }),
      allergies: v.str(b.allergies, 'allergies', { max: 500 }),
      emergencyContact: v.str(b.emergencyContact, 'emergencyContact', { max: 200 }),
      doctorContact: v.str(b.doctorContact, 'doctorContact', { max: 200 }),
      passcodeHash: hashPasscode(passcode),
      passcodeVersion: 1,
      members: [member], medications: [], doses: [], appointments: [], activity: [],
      createdAt: new Date().toISOString(),
    };
    logActivity(profile, member, 'actCreated', { name: profile.name });
    await store.saveProfile(profile);
    res.status(201).json(issueSession(profile, member));
  }));

  // ---- Sign in, or join the circle, with care code + shared passcode ----
  r.post('/api/login', authLimiter, wrap(async (req, res) => {
    const b = req.body || {};
    const profileId = v.str(b.profileId, 'profileId', { required: true, max: 20 }).toUpperCase();
    const profile = await store.getProfile(profileId);
    if (!profile || !verifyPasscode(String(b.passcode || ''), profile.passcodeHash)) throw new AppError('badCredentials', {}, 401);
    const name = v.str(b.name, 'name', { required: true, max: 80 });
    const email = v.email(b.email, 'email');
    let member = profile.members.find((m) => (email && m.email === email) || (!email && m.name.toLowerCase() === name.toLowerCase()));
    if (!member) {
      member = { id: newId(), name, email, role: v.role(b.role || 'family'), notify: true, lang: lang(b, req) };
      profile.members.push(member);
      logActivity(profile, member, 'actJoined');
    } else {
      member.lang = lang(b, req);
    }
    await store.saveProfile(profile);
    res.json(issueSession(profile, member));
  }));

  // ---- Instant personal demo (expires in 24h) ----
  r.post('/api/demo', demoLimiter, wrap(async (req, res) => {
    const { profile, member, passcode } = buildDemoProfile({ lang: lang(req.body || {}, req), seed: Date.now() % 100000 });
    await store.saveProfile(profile);
    // Pre-fill the outbox with the reminders that are due right now, so the demo shows real emails.
    await remindProfile(profile, store, mailer).catch(() => 0);
    res.status(201).json({ ...issueSession(profile, member), passcode });
  }));

  // ---- OAuth (Google / GitHub) ----
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const callbackUrl = (req, provider) => `${process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/auth/${provider}/callback`;

  r.get('/auth/:provider', authLimiter, wrap(async (req, res) => {
    const { url, record } = oauth.begin(req.params.provider, callbackUrl(req, req.params.provider));
    res.set('Set-Cookie', cookie('cc_oauth', sign(record, { ttlMs: 10 * MIN, purpose: 'oauth-state' }), { maxAgeS: 600, secure }));
    res.redirect(302, url);
  }));

  r.get('/auth/:provider/callback', wrap(async (req, res) => {
    const record = verifyToken(parseCookies(req.get('cookie')).cc_oauth, 'oauth-state');
    const clear = cookie('cc_oauth', '', { maxAgeS: 0, secure });
    if (!record || record.provider !== req.params.provider || !req.query.state || record.state !== req.query.state || !req.query.code) {
      res.set('Set-Cookie', clear);
      return res.redirect(302, '/?oauth=failed');
    }
    try {
      const identity = await oauth.complete(req.params.provider, { code: String(req.query.code), redirectUri: callbackUrl(req, req.params.provider), verifier: record.verifier });
      res.set('Set-Cookie', [clear, cookie('cc_identity', sign(identity, { ttlMs: 30 * MIN, purpose: 'identity' }), { maxAgeS: 1800, secure })]);
      return res.redirect(302, '/?oauth=ok');
    } catch (e) {
      console.error('oauth callback:', e.message);
      res.set('Set-Cookie', clear);
      return res.redirect(302, '/?oauth=failed');
    }
  }));

  const identityOf = (req) => verifyToken(parseCookies(req.get('cookie')).cc_identity, 'identity');

  /** Who am I (per OAuth) and which care circles list my verified email? */
  r.get('/api/oauth/identity', wrap(async (req, res) => {
    const id = identityOf(req);
    if (!id) return res.json({ identity: null, circles: [] });
    const circles = [];
    for (const pid of await store.findProfileIdsByEmail(id.email)) {
      const p = await store.getProfile(pid);
      const m = p && p.members.find((x) => x.email === id.email);
      if (m) circles.push({ profileId: p.id, name: p.name, role: m.role });
    }
    res.json({ identity: { name: id.name, email: id.email, provider: id.provider }, circles });
  }));

  r.post('/api/oauth/enter', authLimiter, wrap(async (req, res) => {
    const id = identityOf(req);
    if (!id) throw new AppError('sessionInvalid', {}, 401);
    const profile = await store.getProfile(v.str(req.body?.profileId, 'profileId', { required: true, max: 20 }).toUpperCase());
    const member = profile && profile.members.find((m) => m.email === id.email);
    if (!member) throw new AppError('notInvited', {}, 403);
    member.verified = id.provider;
    member.lang = lang(req.body || {}, req);
    await store.saveProfile(profile);
    res.json(issueSession(profile, member));
  }));

  r.post('/api/oauth/logout', (req, res) => {
    res.set('Set-Cookie', cookie('cc_identity', '', { maxAgeS: 0, secure }));
    res.status(204).end();
  });

  // ---- Signed-in: profile, preferences, passcode ----
  r.get('/api/me', auth, (req, res) => {
    res.json({ member: req.member, profile: publicProfile(req.profile), emailMode: mailer.mode });
  });

  r.put('/api/me', auth, wrap(async (req, res) => {
    if ('lang' in (req.body || {})) req.member.lang = i18n.normLang(req.body.lang);
    await store.saveProfile(req.profile);
    res.json(req.member);
  }));

  r.put('/api/profile', auth, wrap(async (req, res) => {
    const b = req.body || {}; const p = req.profile;
    for (const f of ['conditions', 'allergies']) if (f in b) p[f] = v.str(b[f], f, { max: 500 });
    for (const f of ['emergencyContact', 'doctorContact']) if (f in b) p[f] = v.str(b[f], f, { max: 200 });
    if ('name' in b) p.name = v.str(b.name, 'name', { required: true, max: 80 });
    if ('dob' in b) p.dob = v.date(b.dob, 'dob');
    logActivity(p, req.member, 'actProfile');
    await store.saveProfile(p);
    res.json(publicProfile(p));
  }));

  r.put('/api/profile/passcode', auth, authLimiter, wrap(async (req, res) => {
    const p = req.profile;
    if (!verifyPasscode(String(req.body?.current || ''), p.passcodeHash)) throw new AppError('wrongPasscode', {}, 403);
    p.passcodeHash = hashPasscode(v.passcode(req.body.next));
    p.passcodeVersion += 1; // invalidates every other session
    logActivity(p, req.member, 'actPasscode');
    await store.saveProfile(p);
    res.json(issueSession(p, req.member));
  }));

  // ---- Members ----
  r.post('/api/members', auth, wrap(async (req, res) => {
    const b = req.body || {}; const p = req.profile;
    const email = v.email(b.email, 'email', true);
    if (p.members.some((m) => m.email === email)) return res.status(200).json(p.members.find((m) => m.email === email));
    const m = { id: newId(), name: v.str(b.name, 'name', { required: true, max: 80 }), email, role: v.role(b.role || 'family'), notify: true, lang: i18n.normLang(b.lang || req.lang) };
    p.members.push(m);
    logActivity(p, req.member, 'actInvited', { name: m.name });
    await store.saveProfile(p);
    res.status(201).json(m);
  }));

  r.put('/api/members/:mid', auth, wrap(async (req, res) => {
    const m = req.profile.members.find((x) => x.id === req.params.mid);
    if (!m) throw new AppError('memberNotFound', {}, 404);
    const b = req.body || {};
    if ('name' in b) m.name = v.str(b.name, 'name', { required: true, max: 80 });
    if ('email' in b) m.email = v.email(b.email);
    if ('role' in b) m.role = v.role(b.role);
    if ('notify' in b) m.notify = Boolean(b.notify);
    logActivity(req.profile, req.member, 'actMemberEdit', { name: m.name });
    await store.saveProfile(req.profile);
    res.json(m);
  }));

  r.delete('/api/members/:mid', auth, wrap(async (req, res) => {
    const p = req.profile;
    const idx = p.members.findIndex((x) => x.id === req.params.mid);
    if (idx < 0) throw new AppError('memberNotFound', {}, 404);
    if (p.members.length === 1) throw new AppError('lastMember');
    const [m] = p.members.splice(idx, 1);
    logActivity(p, req.member, 'actMemberRemove', { name: m.name });
    await store.saveProfile(p);
    res.status(204).end();
  }));

  return r;
};
