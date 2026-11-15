'use strict';
const path = require('path');
const express = require('express');
const { createApp } = require('./src/application');
const { Store } = require('./src/store');
const { createMailer, runReminders } = require('./src/reminders');

// On serverless (Vercel) only /tmp is writable; elsewhere use ./data.
const defaultFile = process.env.VERCEL ? '/tmp/carecircle/db.json' : path.join(__dirname, 'data', 'db.json');
const store = new Store(process.env.DATA_FILE || defaultFile);
const mailer = createMailer();
const app = express();
app.use(createApp({ store, mailer }));

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log(`CareCircle listening on :${port} (email: ${mailer.mode})`));
  // In-process reminder loop (every minute). Cloud Scheduler can also hit /internal/reminders/tick.
  const interval = Number(process.env.REMINDER_INTERVAL_MS || 60000);
  setInterval(() => runReminders(store, mailer).catch((e) => console.error('reminder loop', e)), interval).unref();
}

module.exports = app;
