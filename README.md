# CareCircle: Elderly Care & Medication Management

CareCircle is a shared, passcode-protected space where an elderly person, their caretakers and their family manage medications, doctor appointments and daily routines together. It sends email reminders automatically so that missed doses and appointments get noticed.

## Features
- **Shared care circle with passcode access.** Each care profile gets a care code (`CC-XXXXXXXX`) and a shared passcode. Members join with a role: elder, caretaker or family. Passcodes are hashed with scrypt, and sessions use HMAC-signed tokens. Changing the passcode signs out every existing session.
- **Medication schedules.** You can add, edit and delete medicines with dosage, several daily times, start and end dates, instructions and pill stock.
- **Daily dose tracking.** Each dose can be marked Taken, Skipped or Undo, and the app records which member logged it. Doses show as Upcoming, Due now or Missed (30 minutes after the scheduled time). Stock goes down automatically when a dose is taken.
- **Adherence analytics.** Shows the 7-day adherence rate, a daily chart, rates per medicine and a streak of perfect days.
- **Smart insights.** Warns about low stock and refills, spots time slots that keep getting missed and suggests moving them, and lists appointments coming up soon.
- **Appointments.** Full create, edit and delete, with notes and questions for the doctor.
- **Email reminders** for:
  - doses coming up within 15 minutes
  - missed doses
  - appointments the day before and within 2 hours
  - low stock (sent to caretakers and family)

  Each member can turn emails off, and the same reminder is never sent twice. Reminders run every minute inside the app. Cloud Scheduler can also trigger them through `POST /internal/reminders/tick` with an `x-cron-secret` header.
- **Health profile and printable emergency card** listing conditions, allergies, emergency contact, doctor and current medications.
- **Activity log** recording who changed what, so the whole circle stays informed.
- **Accessibility:**
  - large base font and 48px touch targets
  - "Larger text" and "High contrast" modes, plus dark mode
  - skip link, tabs that follow the WAI-ARIA pattern with arrow-key navigation, labelled forms and an `aria-live` area for status messages
  - support for reduced motion
  - **Read today aloud**, which uses speech synthesis to read the day's medicines

## Security
- Content Security Policy (`'self'` only, no inline scripts or styles), HSTS, nosniff, frame-deny and a no-referrer policy.
- Rate limiting on the login, create and passcode-change endpoints, and passcode checks that run in constant time.
- Every input is validated, the JSON body size is limited, and the passcode hash never reaches the browser.

## Run locally
```bash
npm install
npm test        # 12 tests: auth, CRUD, validation, scheduling, adherence, reminders
npm start       # http://localhost:8080
```

## Configuration (environment variables)
| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM` | Real email delivery. If these are not set, the app runs in dry-run mode and reminders appear in the outbox shown in the app. |
| `SESSION_SECRET` | Secret used to sign tokens. Set it so sessions stay valid across restarts. |
| `TZ_REGION` | Time zone used for care schedules (default `Asia/Kolkata`) |
| `CRON_SECRET` | Enables the `/internal/reminders/tick` endpoint for Cloud Scheduler |
| `DATA_FILE` | Where the JSON data is stored |

## Deploy to Cloud Run
```bash
gcloud run deploy carecircle --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars SESSION_SECRET=$(openssl rand -hex 32),TZ_REGION=Asia/Kolkata \
  --min-instances 1 --max-instances 1 --no-cpu-throttling
```
Keeping exactly one instance with CPU always allocated lets the in-app reminder loop keep running. Data is stored in a JSON file inside the container, which is enough for a demo. For production, replace `src/store.js` with Firestore; the store interface is small.

## Architecture
- `src/app.js`: Express routes, authentication middleware and security headers
- `src/care.js`: schedule, adherence and insights logic (pure functions with no side effects)
- `src/reminders.js`: works out which reminders are due, removes duplicates and sends them through SMTP or dry-run mode
- `src/auth.js`, `src/validate.js`, `src/time.js`, `src/store.js`: shared helpers
- `public/`: the browser app, written in plain JavaScript with no build step
