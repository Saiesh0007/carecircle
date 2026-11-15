'use strict';
/**
 * OAuth 2.0 sign-in (Google with PKCE, GitHub). Both are free to register.
 * The provider only proves WHO the user is (a verified email). Access to a care
 * circle still requires that email to be a member of the circle (invited by
 * someone who knows the passcode), or the user joining with the care code + passcode.
 */
const crypto = require('crypto');
const { AppError } = require('./validate');

const PROVIDERS = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    pkce: true,
    idEnv: 'GOOGLE_CLIENT_ID',
    secretEnv: 'GOOGLE_CLIENT_SECRET',
    async profile(accessToken, fetchImpl) {
      const r = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) {
        throw new Error('userinfo failed');
      }
      const u = await r.json();
      if (!u.email || u.email_verified !== true) {
        throw new Error('email not verified');
      }
      return { email: u.email.toLowerCase(), name: u.name || u.email.split('@')[0] };
    },
  },
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    pkce: true,
    idEnv: 'GITHUB_CLIENT_ID',
    secretEnv: 'GITHUB_CLIENT_SECRET',
    async profile(accessToken, fetchImpl) {
      const h = {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'CareCircle',
        Accept: 'application/vnd.github+json',
      };
      const [ur, er] = await Promise.all([
        fetchImpl('https://api.github.com/user', { headers: h }),
        fetchImpl('https://api.github.com/user/emails', { headers: h }),
      ]);
      if (!ur.ok || !er.ok) {
        throw new Error('github profile failed');
      }
      const u = await ur.json();
      const primary = (await er.json()).find((e) => e.primary && e.verified);
      if (!primary) {
        throw new Error('no verified email');
      }
      return { email: primary.email.toLowerCase(), name: u.name || u.login };
    },
  },
};

/** Providers whose client id and secret are both configured. */
function enabledProviders(env = process.env) {
  return Object.entries(PROVIDERS)
    .filter(([, p]) => env[p.idEnv] && env[p.secretEnv])
    .map(([k]) => k);
}

const b64url = (buf) => buf.toString('base64url');

/**
 * OAuth 2.0 authorization-code client (state + PKCE). `begin` returns the redirect URL and the
 * state record to keep in a signed cookie; `complete` exchanges the code for a verified identity.
 * @param {{ env?: object, fetchImpl?: typeof fetch }} [options]
 */
function createOAuth({ env = process.env, fetchImpl = (...a) => fetch(...a) } = {}) {
  function provider(name) {
    const p = PROVIDERS[name];
    if (!p || !env[p.idEnv] || !env[p.secretEnv]) {
      throw new AppError('oauthUnavailable', {}, 404);
    }
    return p;
  }

  /** Returns the redirect URL plus the state record to store in a signed, HttpOnly cookie. */
  function begin(name, redirectUri) {
    const p = provider(name);
    const state = b64url(crypto.randomBytes(24));
    const verifier = b64url(crypto.randomBytes(32));
    const url = new URL(p.authorize);
    url.searchParams.set('client_id', env[p.idEnv]);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', p.scope);
    url.searchParams.set('state', state);
    if (p.pkce) {
      url.searchParams.set(
        'code_challenge',
        b64url(crypto.createHash('sha256').update(verifier).digest()),
      );
      url.searchParams.set('code_challenge_method', 'S256');
    }
    if (name === 'google') {
      url.searchParams.set('prompt', 'select_account');
    }
    return { url: url.toString(), record: { provider: name, state, verifier } };
  }

  /** Exchange the code (after the caller verified `state`) and return a verified identity. */
  async function complete(name, { code, redirectUri, verifier }) {
    const p = provider(name);
    const body = new URLSearchParams({
      client_id: env[p.idEnv],
      client_secret: env[p.secretEnv],
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (p.pkce) {
      body.set('code_verifier', verifier);
    }
    const r = await fetchImpl(p.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const tok = await r.json().catch(() => ({}));
    if (!r.ok || !tok.access_token) {
      throw new Error(`token exchange failed (${r.status})`);
    }
    const who = await p.profile(tok.access_token, fetchImpl);
    return { provider: name, ...who };
  }

  return { begin, complete, enabled: () => enabledProviders(env) };
}

module.exports = { createOAuth, enabledProviders, PROVIDERS };
