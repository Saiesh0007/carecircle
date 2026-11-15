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

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

function buildDemoProfile({ lang = 'en', now = localParts(), seed = 42 } = {}) {
  const rand = seededRandom(seed);
  const id = `CC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const hi = lang === 'hi';
  const start = addDays(now.date, -21);
  const mk = (n) => `${id.slice(3).toLowerCase()}${n}`;

  const medications = [
    { id: mk('m1'), name: 'Metformin', dosage: hi ? '500 mg, 1 गोली' : '500 mg, 1 tablet', times: ['08:00', '20:00'], instructions: hi ? 'भोजन के बाद' : 'After food', stock: 34, startDate: start },
    { id: mk('m2'), name: 'Amlodipine', dosage: hi ? '5 mg, 1 गोली' : '5 mg, 1 tablet', times: ['09:00'], instructions: hi ? 'सुबह, पानी के साथ' : 'Morning, with water', stock: 2, startDate: start },
    { id: mk('m3'), name: 'Atorvastatin', dosage: hi ? '10 mg, 1 गोली' : '10 mg, 1 tablet', times: ['21:30'], instructions: hi ? 'सोने से पहले' : 'At bedtime', stock: 18, startDate: start },
    { id: mk('m4'), name: 'Vitamin D3', dosage: hi ? '1 कैप्सूल' : '1 capsule', times: ['13:00'], instructions: hi ? 'दोपहर के भोजन के साथ' : 'With lunch', stock: 25, startDate: start },
  ].map((m) => ({ ...m, active: true, endDate: '', createdDate: start }));

  // History: evenings (21:30) are frequently missed, which the risk model and insights pick up.
  const missChance = { '08:00': 0.06, '09:00': 0.08, '13:00': 0.15, '20:00': 0.12, '21:30': 0.5 };
  const people = hi ? ['प्रिया', 'रमेश', 'कमला'] : ['Priya', 'Ramesh', 'Kamala'];
  const doses = [];
  for (let i = 21; i >= 1; i--) {
    const date = addDays(now.date, -i);
    for (const m of medications) {
      for (const time of m.times) {
        const r = rand();
        // The last 3 days are perfect so the streak and recent trend look realistic.
        if (i > 3 && r < missChance[time]) continue; // left unrecorded -> counts as missed
        const status = i > 3 && r < missChance[time] + 0.03 ? 'skipped' : 'taken';
        doses.push({ medId: m.id, date, time, status, by: people[Math.floor(rand() * people.length)], at: `${date}T${time}:00.000Z` });
      }
    }
  }
  // Today: morning doses already handled.
  for (const m of medications) {
    for (const time of m.times) {
      if (time < now.time && time <= '09:00') doses.push({ medId: m.id, date: now.date, time, status: 'taken', by: people[2], at: new Date().toISOString() });
    }
  }

  const appointments = [
    { id: mk('a1'), doctor: hi ? 'डॉ. अनीता मेहरा' : 'Dr. Anita Mehra', specialty: hi ? 'हृदय रोग विशेषज्ञ' : 'Cardiologist', date: addDays(now.date, 1), time: '11:30', location: hi ? 'सिटी हार्ट क्लिनिक, पुणे' : 'City Heart Clinic, Pune', notes: hi ? 'BP की डायरी साथ ले जाएँ। शाम को चक्कर आने के बारे में पूछें।' : 'Bring BP diary. Ask about evening dizziness.' },
    { id: mk('a2'), doctor: hi ? 'डॉ. राजीव शाह' : 'Dr. Rajiv Shah', specialty: hi ? 'मधुमेह विशेषज्ञ' : 'Diabetologist', date: addDays(now.date, 12), time: '10:00', location: hi ? 'सह्याद्रि अस्पताल' : 'Sahyadri Hospital', notes: hi ? 'HbA1c जाँच, खाली पेट जाएँ' : 'HbA1c test, go fasting' },
    { id: mk('a3'), doctor: hi ? 'डॉ. सुमन राव' : 'Dr. Suman Rao', specialty: hi ? 'नेत्र रोग विशेषज्ञ' : 'Eye specialist', date: addDays(now.date, -9), time: '16:00', location: hi ? 'विज़न केयर' : 'Vision Care', notes: '' },
  ];

  const members = [
    { id: mk('u1'), name: people[0], email: 'priya.demo@example.com', role: 'family', notify: true, lang },
    { id: mk('u2'), name: people[1], email: 'ramesh.demo@example.com', role: 'caretaker', notify: true, lang },
    { id: mk('u3'), name: people[2], email: 'kamala.demo@example.com', role: 'elder', notify: true, lang },
  ];

  const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  const activity = [
    { at: ago(1), by: `${people[2]} (elder)`, key: 'actDose', params: { status: 'taken', med: 'Metformin', date: now.date, time: '08:00' } },
    { at: ago(20), by: `${people[0]} (family)`, key: 'actApptAdd', params: { doctor: appointments[0].doctor, date: appointments[0].date, time: '11:30' } },
    { at: ago(30), by: `${people[1]} (caretaker)`, key: 'actMedEdit', params: { med: 'Amlodipine' } },
    { at: ago(26 * 24), by: `${people[0]} (family)`, key: 'actCreated', params: { name: hi ? 'कमला देवी' : 'Kamala Devi' } },
  ];

  return {
    profile: {
      id, demo: true,
      name: hi ? 'कमला देवी' : 'Kamala Devi',
      dob: '1948-03-14',
      conditions: hi ? 'टाइप 2 मधुमेह, उच्च रक्तचाप, हल्का घुटने का दर्द' : 'Type 2 diabetes, high blood pressure, mild knee arthritis',
      allergies: hi ? 'पेनिसिलिन' : 'Penicillin',
      emergencyContact: hi ? 'प्रिया (बेटी) +91 98xxxxxx10' : 'Priya (daughter) +91 98xxxxxx10',
      doctorContact: hi ? 'डॉ. राजीव शाह, सह्याद्रि अस्पताल' : 'Dr. Rajiv Shah, Sahyadri Hospital',
      passcodeHash: hashPasscode(DEMO_PASSCODE),
      passcodeVersion: 1,
      members, medications, doses, appointments, activity,
      createdAt: `${start}T08:00:00.000Z`,
      expiresAt: new Date(Date.now() + DEMO_TTL_MS).toISOString(),
    },
    member: members[0],
    passcode: DEMO_PASSCODE,
  };
}

module.exports = { buildDemoProfile, DEMO_PASSCODE, DEMO_TTL_MS };
