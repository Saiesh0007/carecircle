'use strict';
const fs = require('fs');
const path = require('path');

/** Simple JSON-file store with atomic writes. Swap for Firestore in production. */
class Store {
  constructor(file) {
    this.file = file;
    this.data = { profiles: {}, sent: {} };
    if (file && fs.existsSync(file)) {
      try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* start fresh */ }
    }
    this.data.profiles ||= {};
    this.data.sent ||= {};
    this._timer = null;
  }
  getProfile(id) { return this.data.profiles[id] || null; }
  allProfiles() { return Object.values(this.data.profiles); }
  saveProfile(p) { this.data.profiles[p.id] = p; this.persist(); return p; }
  wasSent(key) { return Boolean(this.data.sent[key]); }
  markSent(key) { this.data.sent[key] = Date.now(); this.persist(); }
  persist() {
    if (!this.file || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data));
        fs.renameSync(tmp, this.file);
      } catch (e) { console.error('persist failed', e.message); }
    }, 50);
  }
}
module.exports = { Store };
