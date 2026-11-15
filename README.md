# CareCircle: Elderly Care & Medication Management

**Live:** https://carecircle-ochre.vercel.app  ·  **Try it:** press **"Try the live demo"**. No sign-up is needed: you get a private, pre-filled care circle for 24 hours, and a guided tour starts automatically.

CareCircle is a shared, passcode-protected care space for an **elderly person, their caretakers and their family**. It tracks medicines, doses, doctor visits and routines. It emails reminders before anything is missed and alerts the family when something is. An AI assistant (Groq) and a small machine-learning risk model help the circle act *before* problems happen. The whole product works in **English and Hindi**: the interface, the AI answers, voice input and the emails.

---

## 1. Chosen vertical

**Elderly Care & Medication Management Platform**: a smart, interconnected ecosystem in which:

| Requirement from the brief | How CareCircle meets it |
|---|---|
| Elders manage daily medications, appointments and routines | A "Today" timeline with large one-tap *Taken / Skip* buttons, a "Read today aloud" button, a large-text mode and full Hindi |
| Shared ecosystem: elder, caretakers, family | A **care circle** with roles (elder / caretaker / family), a shared activity feed, and invites by email |
| Secure, passcode-based access | A shared passcode (scrypt-hashed) plus a care code. Changing the passcode signs out every other session. Optional Google/GitHub OAuth for invited members |
| View, add, edit and manage medication schedules | Full CRUD with several daily times, start/end dates, instructions and stock tracking |
| Track adherence | Dose events with who recorded them, 7/14/30-day adherence, a perfect-day streak, a per-medicine rate and a dose heat-map |
| Monitor doctor appointments | Full CRUD, with upcoming and past lists and notes for the doctor |
| Email reminders for missed meds, upcoming doses and appointments | An upcoming dose (15 min before), a **missed dose** (30 min after), an appointment (the day before and 2 h before) and **low stock**. Each email is sent once and in each member's own language |
| Go beyond a basic reminder app | An AI assistant that can *propose* actions, an AI prescription reader, an AI interaction check, an AI weekly family summary, voice input, and an ML missed-dose risk forecast |
| Elders at the centre of their own decisions | The elder is a full member with their own role and voice. The AI never changes a dose; it only proposes, and a human confirms |

## 2. Approach and logic

### The care loop
1. **Plan:** medicines (each with its times) and visits are entered by hand, by pasting a prescription, or by speaking it.
2. **Do:** every scheduled dose appears on the day's timeline. Any member marks it *Taken* or *Skipped* (with undo), and stock goes down automatically.
3. **Detect:** a dose with no record becomes **Due** at its time and **Missed** 30 minutes later. The reminder engine emails the circle.
4. **Anticipate:** the **risk model** scores today's remaining doses, and **insights** flag low stock, time slots that keep getting missed, and visits coming up.
5. **Reflect:** the progress charts and an **AI weekly summary**, which can be emailed to the family, close the loop.

### Decision logic (the context-aware part)
- **Dose status** is worked out from the schedule, the recorded events, the current time in the care time zone (`TZ_REGION`, default `Asia/Kolkata`) and the medicine's start, end and creation dates. A medicine added at 4 pm never reports that morning's slot as missed.
- **Reminder routing** depends on role and preference:
  - Dose and appointment emails go to everyone who has opted in.
  - Refill emails go only to caretakers and family.
  - Each email is written in the recipient's own language.
  - De-duplication keys make sure each reminder is sent once. If the mail transport fails, nothing is marked as sent, so it is retried.
- **Missed-dose risk model (ML):** for each remaining dose, it gives a Bayesian, recency-weighted estimate of P(miss). It uses a Beta prior and exponential decay with a 7-day half-life, and it learns from three signals:
  - the exact medicine and time slot
  - the hour of day across all medicines
  - the weekday

  The signals are blended according to how much evidence each has, and the output is a 0–100 score, a level and plain-language reasons. See `src/care.js` → `riskForecast`.
- **Insights:** low stock (3 days or less), time slots missed 3 or more times in 14 days (with a suggestion to move them), and visits in the next 48 hours.
- **AI assistant "Saathi":**
  - It receives a minimal care snapshot: the schedule, today's statuses, adherence, risk and visits. It gets **no emails, passcodes or contact details**.
  - It answers in the user's language and may **propose** actions: mark a dose, add a medicine, or add a visit.
  - The server validates every proposal against the real data. Unknown IDs, wrong times, past dates and unknown action types are dropped, and at most 5 proposals are kept.
  - The UI only runs an action when the user presses **Confirm**.
  - Safety rules: it is not a doctor, it never changes a dose, and it tells the user to call 112/108 in an emergency.

## 3. How the solution works

```
public/                 Browser app (no build step, ES modules, strict CSP)
  index.html            Semantic layout, dialogs, landing with a CSS 3D scene
  css/styles.css        Design tokens, light/dark/high-contrast, animations, responsive
  js/app.js             Controller: preferences, language, auth, routing
  js/i18n.js            283 UI strings in English + Hindi, Intl formatting
  js/views/*.js         Today, Medicines, Visits, Assistant, Progress, Circle
  js/tour.js            Guided spotlight tour (keyboard accessible)
  js/voice.js           MediaRecorder → Whisper transcription
src/
  application.js        Express app composition (dependency-injected)
  routes/access.js      Circles, passcode login, demo, OAuth, members, profile
  routes/care.js        Medicines, doses, visits, dashboard/analytics read models
  routes/assistant.js   AI endpoints, reminders, cron hook
  care.js               Pure domain logic: schedule, adherence, insights, risk model
  reminders.js          What is due → localized emails → send once
  ai.js                 Groq client: assistant, prescription parser, interactions, summary, STT
  oauth.js              Google (PKCE) + GitHub OAuth 2.0
  store.js              Async storage: Upstash Redis (REST) or JSON file
  auth.js, http.js, validate.js, i18n.js, time.js, demo.js
test/                   49 tests (node:test): API, domain, AI, OAuth, reminders, storage, i18n
```

- **Runtime:** Node 22 and Express. There are only two production dependencies, `express` and `nodemailer`. The Groq, Upstash and OAuth calls use the built-in `fetch`.
- **AI (Groq, free tier):**
  - `openai/gpt-oss-120b` handles reasoning, in JSON mode with low reasoning effort for fast replies.
  - `whisper-large-v3-turbo` handles Hindi and English speech-to-text.
- **Storage:** with `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Vercel KV / Upstash, free tier) it uses Redis. Otherwise it uses a JSON file, which suits local runs and a single container. Each care circle is one document, with an email index for OAuth.
- **Scheduling reminders:**
  - Locally or in a container: a loop that runs every minute.
  - On Vercel: a GitHub Action every 10 minutes and a daily Vercel Cron, both calling `/internal/reminders/tick` (protected by `CRON_SECRET`).
  - Anywhere: the "Send due reminders now" button.
- **Email:** real SMTP when `SMTP_*` is set (for example a free Gmail app password or Brevo). Otherwise a **preview outbox** inside the app. Demo circles never send real mail.

## 4. Security
- **Passcodes:** salted scrypt hashes compared in constant time. Tokens are HMAC-signed, expire, are **bound to a purpose** (session, OAuth state or identity) and to the passcode version.
- **Strict headers:**
  - CSP allows `'self'` scripts only (no inline scripts or styles)
  - HSTS, `X-Frame-Options: DENY`, `nosniff`, COOP, Permissions-Policy
  - headers are applied to both the API and the static files (`vercel.json`)
- **Input handling:** every input is validated (lengths, formats, real calendar dates, 24-hour times, roles, ranges). JSON bodies are limited to 64 kB and audio to 4 MB. The UI never uses `innerHTML`, which prevents XSS.
- **Rate limits:** on sign-in, circle creation, demo creation and AI calls (per member).
- **OAuth:**
  - authorization code flow with **state + PKCE**, with the state kept in a signed HttpOnly cookie
  - only **verified** emails are accepted
  - an OAuth identity can open a circle only if a member has invited that email
- **Privacy by design:** the AI gets the minimum context it needs. The passcode hash and full dose history never reach the browser. Secrets live only in environment variables.

## 5. Accessibility and inclusive design
- Fully localized **Hindi / English**: the UI, the AI replies, voice input, read-aloud (`hi-IN` / `en-IN`) and per-member emails. The `<html lang>` attribute updates when the language changes.
- **Larger text**, **high contrast** and **reduce motion** toggles. The app respects `prefers-reduced-motion` and `prefers-color-scheme`.
- Touch targets of at least 44–48 px, a skip link, landmarks, labelled forms, native `<dialog>` (focus trapping, Esc to close), `aria-live` regions, `aria-current` navigation, and text alternatives for charts.
- Voice input and a **read-aloud** daily summary for people with low vision or low literacy.
- Responsive layout from 320 px phones (with bottom navigation) up to wide desktops, including safe-area insets. The site can be installed as a web app (manifest).

## 6. Testing
```bash
npm install
npm run lint     # ESLint (flat config), 0 issues
npm test         # 49 tests, node:test, no network: Groq/OAuth/Upstash are faked
```
The tests cover:
- authentication and tampered tokens
- validation messages in English and Hindi
- CRUD and stock accounting
- schedule edge cases
- adherence and streaks
- risk-model behaviour
- reminders: localization, de-duplication, opt-out, failure retry, and demo circles never sending real mail
- AI action sanitising and prompt-privacy checks
- the OAuth flow, including CSRF state rejection
- the Upstash protocol
- rate limiting
- translation completeness for every UI key

## 7. Run locally
```bash
npm install
GROQ_API_KEY=... npm start        # http://localhost:8080
```

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Enables the AI features (free key at console.groq.com) |
| `SESSION_SECRET` | Signs tokens. Set it in production so sessions survive restarts |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Persistent storage on Vercel (Upstash Redis free tier) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Real email delivery |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | OAuth sign-in. Callback: `<url>/auth/<provider>/callback` |
| `CRON_SECRET` | Protects `/internal/reminders/tick` |
| `TZ_REGION` | Care time zone (default `Asia/Kolkata`) |

**Deploy:** for Vercel, connect the repo (zero config; `server.js` exports the Express app). A `Dockerfile` is included for Cloud Run or any container host.

## 8. Assumptions
- One care circle centres on **one elderly person**, and the care code plus shared passcode is the access model the brief asks for. OAuth is an optional convenience for members who have been invited.
- All members of a circle are trusted to view and edit everything. Roles shape who gets which reminders and how the activity feed reads, not permissions.
- The schedule is evaluated in a single care time zone (India by default). A dose counts as **missed 30 minutes** after its scheduled time; upcoming reminders go out **15 minutes** before. Both can be configured.
- Stock is counted in units (one unit per dose).
- The AI is an assistant for coordinating care, **not medical advice**. Every AI-proposed change needs a human to confirm it.
- The free tiers (Groq, Upstash, Vercel Hobby, GitHub Actions) are enough for a family-scale workload.
