'use strict';
/**
 * Persistence layer with one async interface and two backends:
 *  - RedisStore: Upstash Redis over its REST API (free tier; used on Vercel when KV/UPSTASH env vars exist)
 *  - FileStore:  in-memory map persisted to a JSON file (local dev, tests, single-instance containers)
 * Each care profile is one JSON document. An email -> profileIds index powers OAuth sign-in.
 */
const fs = require('fs');
const path = require('path');

const OUTBOX_MAX = 40;
const SENT_TTL_S = 3 * 24 * 3600;

class FileStore {
  constructor(file) {
    this.kind = 'file';
    this.file = file;
    this.data = { profiles: {}, sent: {}, outbox: {} };
    if (file && fs.existsSync(file)) {
      try { this.data = { ...this.data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* corrupt file: start fresh */ }
    }
    this.timer = null;
  }
  expired(p) { return p && p.expiresAt && Date.parse(p.expiresAt) < Date.now(); }
  async getProfile(id) {
    const p = this.data.profiles[id];
    if (!p || this.expired(p)) return null;
    return structuredClone(p);
  }
  async saveProfile(p) { this.data.profiles[p.id] = structuredClone(p); this.persist(); return p; }
  async deleteProfile(id) { delete this.data.profiles[id]; this.persist(); }
  async listProfileIds() {
    return Object.values(this.data.profiles).filter((p) => !this.expired(p)).map((p) => p.id);
  }
  async findProfileIdsByEmail(email) {
    return Object.values(this.data.profiles)
      .filter((p) => !this.expired(p) && p.members.some((m) => m.email === email))
      .map((p) => p.id);
  }
  async wasSent(key) { return Boolean(this.data.sent[key]); }
  async markSent(key) {
    this.data.sent[key] = Date.now();
    const cutoff = Date.now() - SENT_TTL_S * 1000;
    for (const [k, at] of Object.entries(this.data.sent)) if (at < cutoff) delete this.data.sent[k];
    this.persist();
  }
  async pushOutbox(profileId, msg) {
    const box = (this.data.outbox[profileId] ||= []);
    box.unshift(msg);
    box.length = Math.min(box.length, OUTBOX_MAX);
    this.persist();
  }
  async getOutbox(profileId) { return this.data.outbox[profileId] || []; }
  persist() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data));
        fs.renameSync(tmp, this.file);
      } catch (e) { console.error('persist failed:', e.message); }
    }, 50);
    this.timer.unref?.();
  }
}

class RedisStore {
  constructor({ url, token, fetchImpl = fetch }) {
    this.kind = 'redis';
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.fetch = fetchImpl;
  }
  async pipeline(commands) {
    const res = await this.fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`redis http ${res.status}`);
    const out = await res.json();
    const err = out.find((r) => r.error);
    if (err) throw new Error(`redis: ${err.error}`);
    return out.map((r) => r.result);
  }
  async cmd(...args) { return (await this.pipeline([args]))[0]; }
  async getProfile(id) {
    const raw = await this.cmd('GET', `profile:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
  async saveProfile(p) {
    const set = ['SET', `profile:${p.id}`, JSON.stringify(p)];
    if (p.expiresAt) set.push('PXAT', String(Date.parse(p.expiresAt)));
    const cmds = [set, ['SADD', 'profiles', p.id]];
    for (const m of p.members) if (m.email) cmds.push(['SADD', `email:${m.email}`, p.id]);
    await this.pipeline(cmds);
    return p;
  }
  async deleteProfile(id) { await this.pipeline([['DEL', `profile:${id}`], ['SREM', 'profiles', id]]); }
  async listProfileIds() {
    const ids = await this.cmd('SMEMBERS', 'profiles');
    if (!ids.length) return [];
    const exists = await this.pipeline(ids.map((id) => ['EXISTS', `profile:${id}`]));
    const gone = ids.filter((_, i) => !exists[i]);
    if (gone.length) await this.cmd('SREM', 'profiles', ...gone);
    return ids.filter((_, i) => exists[i]);
  }
  async findProfileIdsByEmail(email) { return this.cmd('SMEMBERS', `email:${email}`); }
  async wasSent(key) { return Boolean(await this.cmd('EXISTS', `sent:${key}`)); }
  async markSent(key) { await this.cmd('SET', `sent:${key}`, '1', 'EX', String(SENT_TTL_S)); }
  async pushOutbox(profileId, msg) {
    const k = `outbox:${profileId}`;
    await this.pipeline([['LPUSH', k, JSON.stringify(msg)], ['LTRIM', k, '0', String(OUTBOX_MAX - 1)], ['EXPIRE', k, String(7 * 24 * 3600)]]);
  }
  async getOutbox(profileId) {
    return (await this.cmd('LRANGE', `outbox:${profileId}`, '0', String(OUTBOX_MAX - 1))).map((s) => JSON.parse(s));
  }
}

/** Pick the backend from the environment. */
function createStore(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new RedisStore({ url, token });
  const fallback = env.VERCEL ? '/tmp/carecircle/db.json' : path.join(__dirname, '..', 'data', 'db.json');
  return new FileStore(env.DATA_FILE || fallback);
}

module.exports = { FileStore, RedisStore, createStore };
