'use strict';
/**
 * Entry point. Locally / on containers it listens and runs the reminder loop every minute.
 * On Vercel the exported Express app is served as a function; reminders are triggered by
 * a scheduled GitHub Action calling /internal/reminders/tick (and the in-app button).
 */
const express = require('express');
const { createApp } = require('./src/application');
const { createStore } = require('./src/store');
const { createMailer, runReminders } = require('./src/reminders');

const store = createStore();
const mailer = createMailer({ store });
const app = express();
app.use(createApp({ store, mailer }));

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log(`CareCircle on :${port} (storage: ${store.kind}, email: ${mailer.mode})`));
  const interval = Number(process.env.REMINDER_INTERVAL_MS || 60000);
  setInterval(() => runReminders(store, mailer).catch((e) => console.error('reminder loop:', e.message)), interval).unref();
}

module.exports = app;
