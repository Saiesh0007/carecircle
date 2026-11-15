'use strict';
/**
 * Builds a realistic, private demo care circle with 3 weeks of history so new
 * visitors can explore every feature. Each visitor gets their own copy that
 * expires after 24 hours. Randomness is seeded so tests are deterministic.
 */
const crypto = require('crypto');
const { hashPasscode } = require('./auth');
const { localParts, addDays } = require('./time');

const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
const DEMO_PASSCODE = 'demo1234';
const HISTORY_DAYS = 21;
/** The most recent days are recorded perfectly so the streak and trend look realistic. */
const PERFECT_RECENT_DAYS = 3;
/** Probability that a slot is left unrecorded (missed). Evenings are the weak spot. */
const MISS_CHANCE = { '08:00': 0.06, '09:00': 0.08, '13:00': 0.15, '20:00': 0.12, '21:30': 0.5 };
const SKIP_CHANCE = 0.03;

/** All user-visible demo text, per language. */
const TEXT = {
  en: {
    elder: 'Kamala Devi',
    people: ['Priya', 'Ramesh', 'Kamala'],
    conditions: 'Type 2 diabetes, high blood pressure, mild knee arthritis',
    allergies: 'Penicillin',
    emergencyContact: 'Priya (daughter) +91 98xxxxxx10',
    doctorContact: 'Dr. Rajiv Shah, Sahyadri Hospital',
    meds: {
      m1: { dosage: '500 mg, 1 tablet', instructions: 'After food' },
      m2: { dosage: '5 mg, 1 tablet', instructions: 'Morning, with water' },
      m3: { dosage: '10 mg, 1 tablet', instructions: 'At bedtime' },
      m4: { dosage: '1 capsule', instructions: 'With lunch' },
    },
    appts: {
      a1: {
        doctor: 'Dr. Anita Mehra',
        specialty: 'Cardiologist',
        location: 'City Heart Clinic, Pune',
        notes: 'Bring BP diary. Ask about evening dizziness.',
      },
      a2: {
        doctor: 'Dr. Rajiv Shah',
        specialty: 'Diabetologist',
        location: 'Sahyadri Hospital',
        notes: 'HbA1c test, go fasting',
      },
      a3: { doctor: 'Dr. Suman Rao', specialty: 'Eye specialist', location: 'Vision Care' },
    },
  },
  hi: {
    elder: 'कमला देवी',
    people: ['प्रिया', 'रमेश', 'कमला'],
    conditions: 'टाइप 2 मधुमेह, उच्च रक्तचाप, हल्का घुटने का दर्द',
    allergies: 'पेनिसिलिन',
    emergencyContact: 'प्रिया (बेटी) +91 98xxxxxx10',
    doctorContact: 'डॉ. राजीव शाह, सह्याद्रि अस्पताल',
    meds: {
      m1: { dosage: '500 mg, 1 गोली', instructions: 'भोजन के बाद' },
      m2: { dosage: '5 mg, 1 गोली', instructions: 'सुबह, पानी के साथ' },
      m3: { dosage: '10 mg, 1 गोली', instructions: 'सोने से पहले' },
      m4: { dosage: '1 कैप्सूल', instructions: 'दोपहर के भोजन के साथ' },
    },
    appts: {
      a1: {
        doctor: 'डॉ. अनीता मेहरा',
        specialty: 'हृदय रोग विशेषज्ञ',
        location: 'सिटी हार्ट क्लिनिक, पुणे',
        notes: 'BP की डायरी साथ ले जाएँ। शाम को चक्कर आने के बारे में पूछें।',
      },
      a2: {
        doctor: 'डॉ. राजीव शाह',
        specialty: 'मधुमेह विशेषज्ञ',
        location: 'सह्याद्रि अस्पताल',
        notes: 'HbA1c जाँच, खाली पेट जाएँ',
      },
      a3: { doctor: 'डॉ. सुमन राव', specialty: 'नेत्र रोग विशेषज्ञ', location: 'विज़न केयर' },
    },
  },
};

/** Language-independent medicine plan. Amlodipine is nearly out of stock to show refill alerts. */
const MED_PLAN = [
  { key: 'm1', name: 'Metformin', times: ['08:00', '20:00'], stock: 34 },
  { key: 'm2', name: 'Amlodipine', times: ['09:00'], stock: 2 },
  { key: 'm3', name: 'Atorvastatin', times: ['21:30'], stock: 18 },
  { key: 'm4', name: 'Vitamin D3', times: ['13:00'], stock: 25 },
];
/** Appointment dates as offsets from today, plus their times. */
const APPT_PLAN = [
  { key: 'a1', offset: 1, time: '11:30' },
  { key: 'a2', offset: 12, time: '10:00' },
  { key: 'a3', offset: -9, time: '16:00' },
];
const MEMBER_PLAN = [
  { key: 'u1', email: 'priya.demo@example.com', role: 'family' },
  { key: 'u2', email: 'ramesh.demo@example.com', role: 'caretaker' },
  { key: 'u3', email: 'kamala.demo@example.com', role: 'elder' },
];

/** Small deterministic LCG so demo data and tests are reproducible. */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Demo medicines in the visitor's language, all starting `start`. */
function buildMedications(text, mk, start) {
  return MED_PLAN.map(({ key, ...plan }) => ({
    id: mk(key),
    ...plan,
    ...text.meds[key],
    startDate: start,
    active: true,
    endDate: '',
    createdDate: start,
  }));
}

/** Seeded dose history for the past weeks, plus today's morning doses already handled. */
function buildDoses({ medications, people, now, rand }) {
  const doses = [];
  const record = (dose) => doses.push(dose);

  for (let i = HISTORY_DAYS; i >= 1; i--) {
    const date = addDays(now.date, -i);
    for (const m of medications) {
      for (const time of m.times) {
        const r = rand();
        const imperfect = i > PERFECT_RECENT_DAYS;
        if (imperfect && r < MISS_CHANCE[time]) {
          continue; // left unrecorded, so it counts as missed
        }
        const status = imperfect && r < MISS_CHANCE[time] + SKIP_CHANCE ? 'skipped' : 'taken';
        const by = people[Math.floor(rand() * people.length)];
        record({ medId: m.id, date, time, status, by, at: `${date}T${time}:00.000Z` });
      }
    }
  }
  for (const m of medications) {
    for (const time of m.times.filter((x) => x < now.time && x <= '09:00')) {
      record({
        medId: m.id,
        date: now.date,
        time,
        status: 'taken',
        by: people[2],
        at: new Date().toISOString(),
      });
    }
  }
  return doses;
}

/** One visit tomorrow, one in two weeks and one in the past. */
function buildAppointments(text, mk, now) {
  return APPT_PLAN.map(({ key, offset, time }) => ({
    id: mk(key),
    notes: '',
    ...text.appts[key],
    date: addDays(now.date, offset),
    time,
  }));
}

/** A few recent activity-feed entries, stored as i18n keys like real ones. */
function buildActivity({ people, appointments, text, now }) {
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const [family, caretaker, elder] = people;
  return [
    {
      at: ago(1),
      by: `${elder} (elder)`,
      key: 'actDose',
      params: { status: 'taken', med: 'Metformin', date: now.date, time: '08:00' },
    },
    {
      at: ago(20),
      by: `${family} (family)`,
      key: 'actApptAdd',
      params: { doctor: appointments[0].doctor, date: appointments[0].date, time: '11:30' },
    },
    {
      at: ago(30),
      by: `${caretaker} (caretaker)`,
      key: 'actMedEdit',
      params: { med: 'Amlodipine' },
    },
    { at: ago(26 * 24), by: `${family} (family)`, key: 'actCreated', params: { name: text.elder } },
  ];
}

/**
 * Create a complete demo circle in the requested language.
 * @param {{ lang?: 'en'|'hi', now?: ReturnType<typeof localParts>, seed?: number }} [options]
 * @returns {{ profile: object, member: object, passcode: string }}
 */
function buildDemoProfile({ lang = 'en', now = localParts(), seed = 42 } = {}) {
  const text = TEXT[lang] || TEXT.en;
  const id = `CC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const mk = (suffix) => `${id.slice(3).toLowerCase()}${suffix}`;
  const start = addDays(now.date, -HISTORY_DAYS);
  const { people } = text;

  const medications = buildMedications(text, mk, start);
  const doses = buildDoses({ medications, people, now, rand: seededRandom(seed) });
  const appointments = buildAppointments(text, mk, now);
  const members = MEMBER_PLAN.map(({ key, ...m }, i) => ({
    id: mk(key),
    name: people[i],
    ...m,
    notify: true,
    lang,
  }));

  return {
    profile: {
      id,
      demo: true,
      name: text.elder,
      dob: '1948-03-14',
      conditions: text.conditions,
      allergies: text.allergies,
      emergencyContact: text.emergencyContact,
      doctorContact: text.doctorContact,
      passcodeHash: hashPasscode(DEMO_PASSCODE),
      passcodeVersion: 1,
      members,
      medications,
      doses,
      appointments,
      activity: buildActivity({ people, appointments, text, now }),
      createdAt: `${start}T08:00:00.000Z`,
      expiresAt: new Date(Date.now() + DEMO_TTL_MS).toISOString(),
    },
    member: members[0],
    passcode: DEMO_PASSCODE,
  };
}

module.exports = { buildDemoProfile, DEMO_PASSCODE, DEMO_TTL_MS };
