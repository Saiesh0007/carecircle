'use strict';
/**
 * Server-side translations for API errors and reminder emails (English + Hindi).
 * Messages use {placeholders} filled from a params object.
 */
const LANGS = ['en', 'hi'];

const FIELDS = {
  en: {
    name: 'Name',
    dob: 'Date of birth',
    passcode: 'Passcode',
    yourName: 'Your name',
    yourEmail: 'Your email',
    email: 'Email',
    profileId: 'Care code',
    conditions: 'Conditions',
    allergies: 'Allergies',
    emergencyContact: 'Emergency contact',
    doctorContact: 'Doctor',
    dosage: 'Dosage',
    instructions: 'Instructions',
    times: 'Times',
    startDate: 'Start date',
    endDate: 'End date',
    stock: 'Stock',
    doctor: 'Doctor',
    specialty: 'Specialty',
    location: 'Location',
    notes: 'Notes',
    date: 'Date',
    time: 'Time',
    days: 'Days',
    role: 'Role',
    message: 'Message',
    text: 'Text',
    lang: 'Language',
  },
  hi: {
    name: 'नाम',
    dob: 'जन्म तिथि',
    passcode: 'पासकोड',
    yourName: 'आपका नाम',
    yourEmail: 'आपका ईमेल',
    email: 'ईमेल',
    profileId: 'केयर कोड',
    conditions: 'बीमारियाँ',
    allergies: 'एलर्जी',
    emergencyContact: 'आपातकालीन संपर्क',
    doctorContact: 'डॉक्टर',
    dosage: 'खुराक',
    instructions: 'निर्देश',
    times: 'समय',
    startDate: 'शुरू होने की तिथि',
    endDate: 'समाप्ति तिथि',
    stock: 'स्टॉक',
    doctor: 'डॉक्टर',
    specialty: 'विशेषज्ञता',
    location: 'स्थान',
    notes: 'नोट्स',
    date: 'तारीख',
    time: 'समय',
    days: 'दिन',
    role: 'भूमिका',
    message: 'संदेश',
    text: 'पाठ',
    lang: 'भाषा',
  },
};

const MESSAGES = {
  en: {
    required: '{field} is required',
    mustBeText: '{field} must be text',
    tooLong: '{field} is too long (max {max} characters)',
    invalidEmail: '{field} is not a valid email address',
    invalidTimes: 'Add between 1 and 8 times in HH:MM format',
    invalidTime: '{field} must be a time like 08:30',
    invalidDate: '{field} must be a date (YYYY-MM-DD)',
    wholeNumber: '{field} must be a whole number between {min} and {max}',
    passcodeShort: 'Passcode must be at least 6 characters',
    invalidRole: 'Role must be elder, caretaker or family',
    endBeforeStart: 'End date must be after the start date',
    futureDose: 'You cannot record a dose for a future date',
    timeNotInSchedule: "That time is not part of this medicine's schedule",
    invalidStatus: 'Status must be taken, skipped or undo',
    badCredentials: 'Care code or passcode is incorrect.',
    sessionInvalid: 'Your session has ended. Please sign in again.',
    tooMany: 'Too many attempts. Please wait a few minutes and try again.',
    wrongPasscode: 'Current passcode is incorrect.',
    lastMember: 'A care circle needs at least one member.',
    notFound: 'Not found',
    medNotFound: 'Medication not found',
    apptNotFound: 'Appointment not found',
    memberNotFound: 'Member not found',
    aiUnavailable: 'The AI assistant is not available right now. Please try again later.',
    aiBadOutput: 'The AI assistant could not understand that. Please rephrase.',
    audioMissing: 'No audio was received.',
    oauthUnavailable: 'This sign-in option is not configured.',
    oauthFailed: 'Sign-in with {provider} failed. Please try again.',
    notInvited: 'This account is not a member of that care circle.',
    invalidJson: 'Invalid request body',
    serverError: 'Something went wrong. Please try again.',
    forbidden: 'Forbidden',
  },
  hi: {
    required: '{field} आवश्यक है',
    mustBeText: '{field} पाठ होना चाहिए',
    tooLong: '{field} बहुत लंबा है (अधिकतम {max} अक्षर)',
    invalidEmail: '{field} एक मान्य ईमेल पता नहीं है',
    invalidTimes: 'HH:MM प्रारूप में 1 से 8 समय जोड़ें',
    invalidTime: '{field} 08:30 जैसा समय होना चाहिए',
    invalidDate: '{field} एक तारीख होनी चाहिए (YYYY-MM-DD)',
    wholeNumber: '{field} {min} से {max} के बीच पूर्ण संख्या होनी चाहिए',
    passcodeShort: 'पासकोड कम से कम 6 अक्षरों का होना चाहिए',
    invalidRole: 'भूमिका बुज़ुर्ग, देखभालकर्ता या परिवार होनी चाहिए',
    endBeforeStart: 'समाप्ति तिथि शुरू होने की तिथि के बाद होनी चाहिए',
    futureDose: 'भविष्य की तारीख की खुराक दर्ज नहीं की जा सकती',
    timeNotInSchedule: 'यह समय इस दवा के शेड्यूल में नहीं है',
    invalidStatus: 'स्थिति ली गई, छोड़ी गई या पूर्ववत होनी चाहिए',
    badCredentials: 'केयर कोड या पासकोड गलत है।',
    sessionInvalid: 'आपका सत्र समाप्त हो गया है। कृपया फिर से साइन इन करें।',
    tooMany: 'बहुत अधिक प्रयास। कृपया कुछ मिनट रुककर फिर कोशिश करें।',
    wrongPasscode: 'वर्तमान पासकोड गलत है।',
    lastMember: 'केयर सर्कल में कम से कम एक सदस्य होना चाहिए।',
    notFound: 'नहीं मिला',
    medNotFound: 'दवा नहीं मिली',
    apptNotFound: 'अपॉइंटमेंट नहीं मिला',
    memberNotFound: 'सदस्य नहीं मिला',
    aiUnavailable: 'AI सहायक अभी उपलब्ध नहीं है। कृपया बाद में कोशिश करें।',
    aiBadOutput: 'AI सहायक इसे समझ नहीं सका। कृपया दूसरे शब्दों में लिखें।',
    audioMissing: 'कोई ऑडियो प्राप्त नहीं हुआ।',
    oauthUnavailable: 'यह साइन-इन विकल्प कॉन्फ़िगर नहीं है।',
    oauthFailed: '{provider} से साइन-इन विफल रहा। कृपया फिर कोशिश करें।',
    notInvited: 'यह खाता उस केयर सर्कल का सदस्य नहीं है।',
    invalidJson: 'अमान्य अनुरोध',
    serverError: 'कुछ गलत हो गया। कृपया फिर कोशिश करें।',
    forbidden: 'अनुमति नहीं है',
  },
};

const EMAILS = {
  en: {
    upcomingSubject: 'Upcoming dose: {med} at {time}',
    upcomingBody:
      'Hello,\n\n{name} has a dose of {med} ({dosage}) due at {time}.\n{instructions}\nPlease mark it as taken in CareCircle once done.',
    missedSubject: 'Missed dose alert: {med} ({time})',
    missedBody:
      'Hello,\n\nThe {time} dose of {med} for {name} has not been marked as taken.\nPlease check in and record the dose in CareCircle.',
    apptTomorrowSubject: 'Appointment tomorrow: {doctor} at {time}',
    apptTomorrowBody:
      'Reminder: {name} has an appointment with {doctor} on {date} at {time}.\nLocation: {location}\nNotes: {notes}\n\nPlease arrange transport and bring the current medication list.',
    apptSoonSubject: 'Appointment soon: {doctor} at {time}',
    apptSoonBody: '{name} has an appointment with {doctor} today at {time}. Location: {location}.',
    refillSubject: 'Refill needed: {med}',
    refillBody:
      '{med} for {name} has about {days} day(s) of stock left ({stock} units). Please arrange a refill.',
    summarySubject: 'Weekly care summary for {name}',
    asPrescribed: 'as prescribed',
    instructionsLine: 'Instructions: {text}',
    na: 'not specified',
    footer:
      "\n\n— CareCircle. You receive this because you are part of {name}'s care circle. You can turn off emails in the Care circle settings.",
  },
  hi: {
    upcomingSubject: 'आने वाली खुराक: {med} {time} बजे',
    upcomingBody:
      'नमस्ते,\n\n{name} की {med} ({dosage}) की खुराक {time} बजे लेनी है।\n{instructions}\nखुराक लेने के बाद CareCircle में "ली गई" चिह्नित करें।',
    missedSubject: 'छूटी खुराक की सूचना: {med} ({time})',
    missedBody:
      'नमस्ते,\n\n{name} की {time} बजे की {med} की खुराक अभी तक ली गई के रूप में दर्ज नहीं हुई है।\nकृपया संपर्क करें और CareCircle में खुराक दर्ज करें।',
    apptTomorrowSubject: 'कल अपॉइंटमेंट: {doctor} {time} बजे',
    apptTomorrowBody:
      'याद दिलाना: {name} का {date} को {time} बजे {doctor} के साथ अपॉइंटमेंट है।\nस्थान: {location}\nनोट्स: {notes}\n\nकृपया आने-जाने की व्यवस्था करें और दवाओं की सूची साथ रखें।',
    apptSoonSubject: 'जल्द अपॉइंटमेंट: {doctor} {time} बजे',
    apptSoonBody: '{name} का आज {time} बजे {doctor} के साथ अपॉइंटमेंट है। स्थान: {location}।',
    refillSubject: 'दवा दोबारा मंगवाएँ: {med}',
    refillBody:
      '{name} की {med} लगभग {days} दिन की ही बची है ({stock} यूनिट)। कृपया दवा मंगवाने की व्यवस्था करें।',
    summarySubject: '{name} की साप्ताहिक देखभाल रिपोर्ट',
    asPrescribed: 'डॉक्टर के अनुसार',
    instructionsLine: 'निर्देश: {text}',
    na: 'उल्लेख नहीं',
    footer:
      '\n\n— CareCircle. आपको यह ईमेल इसलिए मिला क्योंकि आप {name} के केयर सर्कल का हिस्सा हैं। आप केयर सर्कल सेटिंग में ईमेल बंद कर सकते हैं।',
  },
};

const normLang = (l) => (LANGS.includes(l) ? l : 'en');
/** Replace `{name}` placeholders with params; unknown placeholders are left as-is. */
function fill(str, params = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`,
  );
}
/** Translate a server message key, falling back to English and then to the key itself. */
function t(lang, key, params = {}) {
  const L = normLang(lang);
  const field = params.field ? FIELDS[L][params.field] || params.field : undefined;
  return fill(MESSAGES[L][key] || MESSAGES.en[key] || key, { ...params, field });
}
/** Translate an email template key for the recipient's language. */
function email(lang, key, params = {}) {
  const L = normLang(lang);
  return fill(EMAILS[L][key] || EMAILS.en[key], params);
}

module.exports = { LANGS, normLang, t, email, fill, MESSAGES };
