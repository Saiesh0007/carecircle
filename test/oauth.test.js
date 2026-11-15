'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const { enabledProviders } = require('../src/oauth');

const ENV = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' };
let h;
let tokenRequests = [];

async function fakeProvider(url, init = {}) {
  if (url === 'https://oauth2.googleapis.com/token') {
    tokenRequests.push(Object.fromEntries(new URLSearchParams(init.body)));
    return Response.json({ access_token: 'at-123' });
  }
  if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
    return Response.json({ email: 'Neel@Example.com', email_verified: true, name: 'Neel' });
  }
  return new Response('not found', { status: 404 });
}

before(async () => {
  h = await startServer({ oauthEnv: ENV, oauthFetch: fakeProvider });
});
after(() => h.close());

const cookieOf = (res, name) =>
  (res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)) || '').split(';')[0];

test('providers are only enabled when fully configured', async () => {
  assert.deepEqual(enabledProviders({ GOOGLE_CLIENT_ID: 'x' }), []);
  assert.deepEqual(enabledProviders(ENV), ['google']);
  assert.deepEqual((await h.call('/api/config')).body.oauth, ['google']);
  assert.equal((await h.call('/auth/github', { redirect: 'manual' })).status, 404);
});

test('authorize redirect uses state + PKCE and an HttpOnly state cookie', async () => {
  const r = await h.call('/auth/google', { redirect: 'manual' });
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.origin, 'https://accounts.google.com');
  assert.equal(loc.searchParams.get('client_id'), 'gid');
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(loc.searchParams.get('state').length > 20);
  assert.match(r.headers.getSetCookie()[0], /HttpOnly; SameSite=Lax/);
});

test('callback rejects a mismatched state (CSRF protection)', async () => {
  const start = await h.call('/auth/google', { redirect: 'manual' });
  const cb = await h.call('/auth/google/callback?code=abc&state=attacker', {
    redirect: 'manual',
    headers: { cookie: cookieOf(start, 'cc_oauth') },
  });
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.get('location'), '/?oauth=failed');
  const noCookie = await h.call('/auth/google/callback?code=abc&state=x', { redirect: 'manual' });
  assert.equal(noCookie.headers.get('location'), '/?oauth=failed');
});

test('full flow: verified email signs in only to circles that invited it', async () => {
  // A circle invites neel@example.com
  const owner = await h.newCircle();
  await h.call('/api/members', {
    method: 'POST',
    token: owner.token,
    body: { name: 'Neel', email: 'neel@example.com', role: 'family' },
  });
  const other = await h.newCircle({ name: 'Someone else' });

  const start = await h.call('/auth/google', { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  tokenRequests = [];
  const cb = await h.call(`/auth/google/callback?code=good-code&state=${state}`, {
    redirect: 'manual',
    headers: { cookie: cookieOf(start, 'cc_oauth') },
  });
  assert.equal(cb.headers.get('location'), '/?oauth=ok');
  assert.equal(tokenRequests[0].code, 'good-code');
  assert.ok(tokenRequests[0].code_verifier, 'PKCE verifier is sent');
  const identity = cookieOf(cb, 'cc_identity');
  assert.ok(identity);

  const who = await h.call('/api/oauth/identity', { headers: { cookie: identity } });
  assert.equal(who.body.identity.email, 'neel@example.com');
  assert.deepEqual(
    who.body.circles.map((c) => c.profileId),
    [owner.profileId],
  );

  const enter = await h.call('/api/oauth/enter', {
    method: 'POST',
    headers: { cookie: identity },
    body: { profileId: owner.profileId },
  });
  assert.equal(enter.status, 200);
  assert.equal(enter.body.member.email, 'neel@example.com');
  assert.equal(enter.body.member.verified, 'google');

  const denied = await h.call('/api/oauth/enter', {
    method: 'POST',
    headers: { cookie: identity },
    body: { profileId: other.profileId },
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await h.call('/api/oauth/enter', { method: 'POST', body: { profileId: owner.profileId } }))
      .status,
    401,
  );
});
