'use strict';
const path = require('path');
const { createApp } = require('./src/app');
const { Store } = require('./src/store');
const { createMailer, runReminders } = require('./src/reminders');

const store = new Store(process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json'));
const mailer = createMailer();
const app = createApp({ store, mailer });
const port = Number(process.env.PORT || 8080);

app.listen(port, () => console.log(`CareCircle listening on :${port} (email: ${mailer.mode})`));

// In-process reminder loop (every minute). Cloud Scheduler can also hit /internal/reminders/tick.
const interval = Number(process.env.REMINDER_INTERVAL_MS || 60000);
setInterval(() => runReminders(store, mailer).catch((e) => console.error('reminder loop', e)), interval).unref();
