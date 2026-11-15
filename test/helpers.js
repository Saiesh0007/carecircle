'use strict';
/** Test harness: boots the real Express app on a random port with in-memory storage and fakes for Groq/OAuth. */
const { createApp } = require('../src/application');
const { FileStore } = require('../src/store');
const { createMailer } = require('../src/reminders');
const { createAI } = require('../src/ai');
const { createOAuth } = require('../src/oauth');

/** Fake fetch for the Groq API. `replies` maps an endpoint to a function returning the JSON body. */
function fakeGroq(handlers = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    if (path.endsWith('/audio/transcriptions')) return Response.json(handlers.transcribe ? handlers.transcribe(init) : { text: 'hello' });
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const content = handlers.chat ? handlers.chat(system, body) : { reply: 'ok', actions: [] };
    return Response.json({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] });
  };
  return { impl, calls };
}

async function startServer({ ai, oauthEnv = {}, oauthFetch } = {}) {
  process.env.AUTH_RATE_MAX ||= '1000'; // many sign-ins per test file; the limiter has its own test
  const store = new FileStore(null);
  const mailer = createMailer({ store });
  const app = createApp({
    store, mailer,
    ai: ai || createAI({ apiKey: null }),
    oauth: createOAuth({ env: oauthEnv, fetchImpl: oauthFetch }),
  });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(path, { method = 'GET', body, token, lang, headers = {}, raw, redirect = 'follow' } = {}) {
    const res = await fetch(base + path, {
      method, redirect,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(lang ? { 'x-lang': lang } : {}),
        ...headers,
      },
      body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  }

  async function newCircle(extra = {}) {
    const r = await call('/api/profiles', {
      method: 'POST',
      body: { name: 'Asha', passcode: 'secret123', yourName: 'Ravi', yourEmail: 'ravi@example.com', yourRole: 'caretaker', ...extra },
    });
    if (r.status !== 201) throw new Error(`newCircle failed: ${JSON.stringify(r.body)}`);
    return r.body;
  }

  return { server, store, mailer, base, call, newCircle, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { startServer, fakeGroq };
