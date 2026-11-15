// English + Hindi translations for the whole interface, plus locale-aware formatting helpers.
const DICT = {
  en: {
    docTitle: 'CareCircle: medication & care for elders, together',
    skipLink: 'Skip to main content', displayOptions: 'Display options', largerText: 'Larger text', highContrast: 'High contrast', reduceMotion: 'Reduce motion',
    startTour: 'Start guided tour', signOut: 'Sign out', sections: 'Sections',
    heroEyebrow: 'For elders, caretakers and family',
    heroTitle: 'Care that keeps everyone in the loop.',
    heroLead: 'One shared, passcode-protected space to manage medicines, doctor visits and daily routines, with reminders that reach the whole family before anything is missed.',
    tryDemo: 'Try the live demo', signInJoin: 'Sign in or join', heroNote: 'No signup needed for the demo. It is your own private copy for 24 hours.',
    trust1: 'Hindi & English', trust2: 'AI care assistant', trust3: 'Email reminders',
    sceneName: 'Kamala Devi, 78', sceneSub: 'Today · 3 of 5 doses', sceneAdherence: 'this week', sceneMailTitle: 'Missed dose alert', sceneMailSub: 'Sent to Priya and Ramesh',
    featTitle: 'Everything a care circle needs',
    f1t: 'Never miss a dose', f1d: 'Daily timeline with one-tap Taken / Skip. Missed doses alert the family by email automatically.',
    f2t: 'AI care assistant', f2d: 'Ask in Hindi or English, by voice or text. Paste a prescription and it fills the schedule for you.',
    f3t: 'Predicts missed doses', f3d: 'A risk model learns from past weeks and warns you which dose is likely to be missed today.',
    f4t: 'Shared and secure', f4d: 'Family joins with a care code and passcode, or signs in with Google / GitHub. The elder stays at the centre.',
    howTitle: 'How it works',
    h1t: 'Create a care circle', h1d: "Add the elder's health profile and choose a shared passcode.",
    h2t: 'Invite the family', h2d: 'Share the care code. Everyone picks a role: elder, caretaker or family.',
    h3t: 'Stay in sync', h3d: 'Track doses and visits together; reminders and AI insights do the rest.',
    footNote: 'CareCircle supports care coordination and is not a substitute for medical advice. In an emergency call 112.',
    navToday: 'Today', navMeds: 'Medicines', navAppts: 'Visits', navAssistant: 'Assistant', navProgress: 'Progress', navCircle: 'Circle',
    demoBanner: 'You are exploring a private demo. Data resets in 24 hours.', takeTour: 'Take the tour',
    readAloud: 'Read today aloud', statAdherence: 'Adherence', last7: 'Last 7 days', statNextDose: 'Next dose', statStreak: 'Perfect-day streak', statNextVisit: 'Next visit',
    todayMeds: "Today's medicines", riskTitle: 'Missed-dose risk today', mlTag: 'ML', riskHelp: 'Learned from the last 4 weeks of doses. Give extra attention to high-risk doses.',
    insightsTitle: 'Smart insights', checkInteractions: 'Check interactions', aiTag: 'AI', addMedicine: 'Add medicine',
    rxTitle: 'Add from a prescription', rxHelp: 'Paste or speak the prescription, e.g. "Metformin 500mg 1-0-1 after food". The AI fills in the schedule and you review it before saving.',
    rxPlaceholder: 'Tab Metformin 500mg 1-0-1 after food x 30 days', speak: 'Speak', readPrescription: 'Read prescription',
    apptsTitle: 'Doctor visits', addAppointment: 'Add visit', upcoming: 'Upcoming', past: 'Past',
    asstTitle: 'Saathi, your care assistant', asstSub: "Ask anything about today's care, in Hindi or English. It can also record doses and add visits once you confirm.",
    askPlaceholder: 'Ask Saathi…', send: 'Send', aiDisclaimer: 'Saathi is not a doctor. For changes to medicines, consult your doctor. In an emergency call 112.',
    period: 'Period', d7: '7 days', d14: '14 days', d30: '30 days', dailyAdherence: 'Daily adherence', heatTitle: 'Dose map', heatHelp: 'Each square is one dose',
    weeklySummary: 'Weekly summary for family', summaryHelp: 'Generate a short, friendly update on how the week went, with suggestions for the family.',
    generate: 'Generate', emailFamily: 'Email to family', byMedicine: 'By medicine', activity: 'Recent activity',
    careCircle: 'Care circle', healthProfile: 'Health profile', fName: 'Name', fDob: 'Date of birth', fConditions: 'Conditions', fAllergies: 'Allergies',
    fEmergency: 'Emergency contact', fDoctor: 'Primary doctor', save: 'Save', printCard: 'Print emergency card', members: 'Members', careCode: 'Care code', copy: 'Copy',
    inviteByEmail: 'Invite by email', inviteHelp: 'Invited people can sign in with Google or GitHub using this email, without the passcode.',
    fEmail: 'Email', fRole: 'Role', invite: 'Invite', emailReminders: 'Email reminders', sendDueNow: 'Send due reminders now',
    changePasscode: 'Change shared passcode', currentPasscode: 'Current passcode', newPasscode: 'New passcode (min 6)',
    close: 'Close', welcome: 'Welcome to CareCircle', withGoogle: 'Continue with Google', withGithub: 'Continue with GitHub', or: 'or',
    signInJoinShort: 'Sign in / join', createCircle: 'Create circle', sharedPasscode: 'Shared passcode', yourName: 'Your name', iAm: 'I am',
    yourEmailOpt: 'Your email (for reminders)', openCircle: 'Open care circle', elderName: 'Name of the elder', choosePasscode: 'Choose a shared passcode (min 6)',
    fMedName: 'Medicine name', fDosage: 'Dosage', dosagePh: 'e.g. 500 mg, 1 tablet', fTimes: 'Times of day', addTime: '+ Add time', fStock: 'Pills in stock',
    fStart: 'Start date', fEnd: 'End date', fInstructions: 'Instructions', instrPh: 'e.g. after food', fDoctorName: 'Doctor', fSpecialty: 'Specialty',
    fDate: 'Date', fTime: 'Time', fLocation: 'Location', fNotes: 'Notes / questions for the doctor', cancel: 'Cancel', confirm: 'Confirm',
    skipTour: 'Skip', back: 'Back', next: 'Next', finish: 'Finish',

    role_family: 'Family', role_caretaker: 'Caretaker', role_elder: 'Elder',
    status_taken: 'Taken', status_missed: 'Missed', status_due: 'Due now', status_pending: 'Upcoming', status_skipped: 'Skipped', status_cleared: 'Cleared',
    level_high: 'High', level_medium: 'Medium', level_low: 'Low',
    greetMorning: 'Good morning, {name}', greetAfternoon: 'Good afternoon, {name}', greetEvening: 'Good evening, {name}',
    allDone: 'All done', noMoreDoses: 'No more doses today', daysCount: '{n} days', none: 'None', doneOf: '{done} of {total} done',
    noDosesToday: 'No medicines scheduled today. Add them in Medicines.', riskNone: 'No remaining doses today.', riskAria: '{pct} percent risk, {level}',
    insNone: 'Everything looks on track.', insRefill: '{med}: only about {days} day(s) of stock left. Arrange a refill.',
    insPattern: 'Doses at {time} were missed {count} times in the last 2 weeks. Consider moving them to a time that fits the routine better.',
    insAppt: 'Upcoming: {doctor} on {date} at {time}.',
    riskSlot: 'Missed {pct}% recently', riskHour: 'This hour is often missed', riskWeekday: 'This weekday is harder',
    recordedBy: 'Recorded by {name}', undo: 'Undo', taken: 'Taken', skip: 'Skip',
    undoAria: 'Undo {med} at {time}', takenAria: 'Mark {med} at {time} as taken', skipAria: 'Mark {med} at {time} as skipped',
    allDoneToast: 'All doses done for today. Wonderful!', markedTaken: '{med} marked as taken', markedSkipped: '{med} marked as skipped', cleared: 'Cleared',
    noSpeech: 'Read aloud is not supported in this browser',
    speakLeft: 'Hello {name}. Still to take today: {list}.', speakItem: '{med}, {dosage}, at {time}', speakDone: "Well done {name}. All of today's medicines are done.",
    removeTime: 'Remove time', editMed: 'Edit {med}', medUpdated: 'Medicine updated', medAdded: 'Medicine added', asPrescribed: 'As prescribed',
    stockLine: '{stock} left · about {days} days', stockUntracked: 'Stock not tracked', until: 'Until {date}', edit: 'Edit', delete: 'Delete', deleteMed: 'Delete {med}',
    confirmDeleteMed: 'Delete {med} and its dose history?', medDeleted: 'Medicine deleted', noMeds: 'No medicines yet. Add one, or paste a prescription above.',
    rxNothing: 'No medicines found in that text.', rxReview: 'Please check these before adding:', add: 'Add', added: 'Added', asNeeded: 'When needed', forDays: 'for {n} days',
    interactionsTitle: 'Medicine check', sev_high: 'Important', sev_moderate: 'Worth discussing', sev_low: 'Minor',
    editAppt: 'Edit visit with {doctor}', apptUpdated: 'Visit updated', apptAdded: 'Visit added', deleteAppt: 'Delete visit with {doctor}',
    noUpcoming: 'No upcoming visits.', noPast: 'No past visits.', confirmDeleteAppt: 'Delete the visit with {doctor}?', apptDeleted: 'Visit deleted',
    asstHello: "Namaste {name}! I'm Saathi. Ask me what's left today, how the week went, or tell me a dose was taken.",
    chip1: "What's left for today?", chip2: 'How was adherence this week?', chip3: 'Which dose is most likely to be missed?', chip4: 'What should we ask the doctor at the next visit?',
    actMarkTaken: 'Mark {med} ({time}) as taken', actMarkSkipped: 'Mark {med} ({time}) as skipped', actAddMed: 'Add {med} at {times}', actAddAppt: 'Add visit: {doctor}, {date} {time}',
    done: 'Done', actionDone: 'Done and saved', thinking: 'Saathi is thinking',
    dosesTaken: 'Doses taken', dosesMissed: 'Doses missed', barsAria: 'Daily adherence: {list}', noData: 'No data yet', noDose: 'no dose', noActivity: 'No activity yet.',
    wins: 'What went well', concerns: 'Keep an eye on', suggestions: 'Suggestions', summarySent: 'Summary emailed to {n} member(s)',
    actCreated: 'created the care circle for {name}', actJoined: 'joined the care circle', actProfile: 'updated the health profile', actPasscode: 'changed the shared passcode',
    actInvited: 'invited {name}', actMemberEdit: 'updated member {name}', actMemberRemove: 'removed {name}', actMedAdd: 'added {med} at {times}',
    actMedEdit: 'edited {med}', actMedRemove: 'removed {med}', actDose: '{status}: {med} ({date}, {time})', actApptAdd: 'added a visit with {doctor} on {date}',
    actApptEdit: 'updated the visit with {doctor}', actApptRemove: 'cancelled the visit with {doctor}',
    emailsOn: 'Emails on', emailsOff: 'Emails off', you: 'you', noEmail: 'no email', removeMember: 'Remove {name}', remove: 'Remove',
    emailModeSmtp: 'Reminders are emailed automatically for upcoming and missed doses, visits and refills, in each member\'s language.',
    emailModeDry: 'Preview mode: no mail server is configured, so reminder emails appear in this outbox instead of being sent.',
    confirmRemoveMember: 'Remove {name} from the care circle?', memberRemoved: 'Member removed', to: 'To', preview: 'preview', outboxEmpty: 'No reminders yet.',
    profileSaved: 'Profile saved', emergencyCard: 'Emergency card', currentMeds: 'Current medicines', copied: 'Care code copied', invited: 'Invitation saved',
    passcodeChanged: 'Passcode changed. Others will need the new one.', remindersSent: '{n} reminder(s) sent',
    sessionEnded: 'Your session ended. Please sign in again.', signedOut: 'Signed out', demoReady: 'Demo ready! Care code {code}, passcode {pass}.',
    welcomeBack: 'Welcome, {name}', oauthFailed: 'Sign-in failed. Please try again.',
    oauthPick: 'Hi {name}, choose a care circle:', oauthNoCircle: 'Hi {name}. {email} is not in any care circle yet. Join with a care code, or create a new circle.',
    genericError: 'Something went wrong. Please try again.', offline: 'You seem to be offline. Please check your connection.',
    micDenied: 'Microphone access was blocked.', listening: 'Listening… tap the mic again to stop.',
    tourStepOf: 'Step {n} of {total}',
    tourStatsT: 'The day at a glance', tourStatsD: 'Adherence for the week, the next dose, the perfect-day streak and the next doctor visit.',
    tourTimelineT: "Today's medicines", tourTimelineD: 'Tap Taken or Skip. Everyone in the circle sees it instantly, and missed doses alert the family by email.',
    tourRiskT: 'Predicts missed doses', tourRiskD: 'A small machine-learning model learns from 4 weeks of history and flags which dose needs extra attention today.',
    tourRxT: 'Prescription to schedule', tourRxD: 'Paste or speak a prescription like "1-0-1 after food" and the AI turns it into a reminder schedule.',
    tourAssistantT: 'Meet Saathi', tourAssistantD: 'Ask questions in Hindi or English by voice or text. Saathi can record doses or add visits after you confirm.',
    tourSummaryT: 'Weekly family update', tourSummaryD: 'One tap writes a friendly summary of the week, and it can be emailed to the whole family.',
    tourMembersT: 'The care circle', tourMembersD: 'Share the care code, invite by email and choose who gets reminders. Each member gets emails in their own language.',
    tourLangT: 'हिंदी में भी', tourLangD: 'Switch the entire app, the AI and the emails to Hindi at any time.',
  },
  hi: {
    docTitle: 'CareCircle: बुज़ुर्गों की दवा और देखभाल, सब साथ मिलकर',
    skipLink: 'मुख्य सामग्री पर जाएँ', displayOptions: 'डिस्प्ले विकल्प', largerText: 'बड़े अक्षर', highContrast: 'उच्च कंट्रास्ट', reduceMotion: 'एनिमेशन कम करें',
    startTour: 'गाइडेड टूर शुरू करें', signOut: 'साइन आउट', sections: 'अनुभाग',
    heroEyebrow: 'बुज़ुर्गों, देखभालकर्ताओं और परिवार के लिए',
    heroTitle: 'ऐसी देखभाल, जिसमें सब जुड़े रहें।',
    heroLead: 'दवाइयों, डॉक्टर की मुलाक़ातों और रोज़ की दिनचर्या के लिए एक साझा, पासकोड-सुरक्षित जगह, जहाँ रिमाइंडर पूरे परिवार तक पहुँचते हैं ताकि कुछ भी न छूटे।',
    tryDemo: 'लाइव डेमो देखें', signInJoin: 'साइन इन करें या जुड़ें', heroNote: 'डेमो के लिए साइन अप की ज़रूरत नहीं। यह 24 घंटे के लिए आपकी अपनी निजी कॉपी है।',
    trust1: 'हिंदी और अंग्रेज़ी', trust2: 'AI देखभाल सहायक', trust3: 'ईमेल रिमाइंडर',
    sceneName: 'कमला देवी, 78', sceneSub: 'आज · 5 में से 3 खुराक', sceneAdherence: 'इस सप्ताह', sceneMailTitle: 'छूटी खुराक की सूचना', sceneMailSub: 'प्रिया और रमेश को भेजा गया',
    featTitle: 'केयर सर्कल की हर ज़रूरत',
    f1t: 'कोई खुराक न छूटे', f1d: 'रोज़ की टाइमलाइन, एक टैप में "ली गई" / "छोड़ें"। खुराक छूटने पर परिवार को अपने आप ईमेल।',
    f2t: 'AI देखभाल सहायक', f2d: 'हिंदी या अंग्रेज़ी में बोलकर या लिखकर पूछें। पर्चा पेस्ट करें, शेड्यूल अपने आप बन जाएगा।',
    f3t: 'छूटने वाली खुराक का अनुमान', f3d: 'एक रिस्क मॉडल पिछले हफ़्तों से सीखकर बताता है कि आज कौन-सी खुराक छूट सकती है।',
    f4t: 'साझा और सुरक्षित', f4d: 'परिवार केयर कोड और पासकोड से जुड़ता है, या Google / GitHub से साइन इन करता है। बुज़ुर्ग हमेशा केंद्र में।',
    howTitle: 'यह कैसे काम करता है',
    h1t: 'केयर सर्कल बनाएँ', h1d: 'बुज़ुर्ग की स्वास्थ्य प्रोफ़ाइल जोड़ें और एक साझा पासकोड चुनें।',
    h2t: 'परिवार को जोड़ें', h2d: 'केयर कोड साझा करें। हर कोई अपनी भूमिका चुने: बुज़ुर्ग, देखभालकर्ता या परिवार।',
    h3t: 'सब एक साथ', h3d: 'खुराक और मुलाक़ातें मिलकर ट्रैक करें; बाकी काम रिमाइंडर और AI करेंगे।',
    footNote: 'CareCircle देखभाल में मदद करता है, यह डॉक्टर की सलाह का विकल्प नहीं है। आपात स्थिति में 112 पर कॉल करें।',
    navToday: 'आज', navMeds: 'दवाइयाँ', navAppts: 'मुलाक़ातें', navAssistant: 'सहायक', navProgress: 'प्रगति', navCircle: 'सर्कल',
    demoBanner: 'आप एक निजी डेमो देख रहे हैं। डेटा 24 घंटे में रीसेट हो जाएगा।', takeTour: 'टूर देखें',
    readAloud: 'आज का शेड्यूल सुनें', statAdherence: 'दवा पालन', last7: 'पिछले 7 दिन', statNextDose: 'अगली खुराक', statStreak: 'लगातार पूरे दिन', statNextVisit: 'अगली मुलाक़ात',
    todayMeds: 'आज की दवाइयाँ', riskTitle: 'आज खुराक छूटने का जोखिम', mlTag: 'ML', riskHelp: 'पिछले 4 हफ़्तों की खुराकों से सीखा गया। ज़्यादा जोखिम वाली खुराक पर ख़ास ध्यान दें।',
    insightsTitle: 'स्मार्ट सुझाव', checkInteractions: 'दवा जाँच', aiTag: 'AI', addMedicine: 'दवा जोड़ें',
    rxTitle: 'पर्चे से जोड़ें', rxHelp: 'पर्चा पेस्ट करें या बोलें, जैसे "Metformin 500mg 1-0-1 खाने के बाद"। AI शेड्यूल भर देगा, आप सेव करने से पहले जाँच लें।',
    rxPlaceholder: 'Tab Metformin 500mg 1-0-1 खाने के बाद x 30 दिन', speak: 'बोलें', readPrescription: 'पर्चा पढ़ें',
    apptsTitle: 'डॉक्टर से मुलाक़ातें', addAppointment: 'मुलाक़ात जोड़ें', upcoming: 'आने वाली', past: 'पिछली',
    asstTitle: 'साथी, आपका देखभाल सहायक', asstSub: 'आज की देखभाल के बारे में हिंदी या अंग्रेज़ी में कुछ भी पूछें। आपकी पुष्टि के बाद यह खुराक दर्ज कर सकता है और मुलाक़ातें जोड़ सकता है।',
    askPlaceholder: 'साथी से पूछें…', send: 'भेजें', aiDisclaimer: 'साथी डॉक्टर नहीं है। दवा में बदलाव के लिए अपने डॉक्टर से सलाह लें। आपात स्थिति में 112 पर कॉल करें।',
    period: 'अवधि', d7: '7 दिन', d14: '14 दिन', d30: '30 दिन', dailyAdherence: 'रोज़ का दवा पालन', heatTitle: 'खुराक नक्शा', heatHelp: 'हर खाना एक खुराक है',
    weeklySummary: 'परिवार के लिए साप्ताहिक रिपोर्ट', summaryHelp: 'सप्ताह कैसा रहा, इसकी एक छोटी और आसान रिपोर्ट बनाएँ, परिवार के लिए सुझावों के साथ।',
    generate: 'बनाएँ', emailFamily: 'परिवार को ईमेल करें', byMedicine: 'दवा के अनुसार', activity: 'हाल की गतिविधि',
    careCircle: 'केयर सर्कल', healthProfile: 'स्वास्थ्य प्रोफ़ाइल', fName: 'नाम', fDob: 'जन्म तिथि', fConditions: 'बीमारियाँ', fAllergies: 'एलर्जी',
    fEmergency: 'आपातकालीन संपर्क', fDoctor: 'मुख्य डॉक्टर', save: 'सेव करें', printCard: 'आपातकालीन कार्ड प्रिंट करें', members: 'सदस्य', careCode: 'केयर कोड', copy: 'कॉपी करें',
    inviteByEmail: 'ईमेल से आमंत्रित करें', inviteHelp: 'आमंत्रित लोग इसी ईमेल से Google या GitHub द्वारा बिना पासकोड के साइन इन कर सकते हैं।',
    fEmail: 'ईमेल', fRole: 'भूमिका', invite: 'आमंत्रित करें', emailReminders: 'ईमेल रिमाइंडर', sendDueNow: 'अभी के रिमाइंडर भेजें',
    changePasscode: 'साझा पासकोड बदलें', currentPasscode: 'वर्तमान पासकोड', newPasscode: 'नया पासकोड (कम से कम 6)',
    close: 'बंद करें', welcome: 'CareCircle में आपका स्वागत है', withGoogle: 'Google से जारी रखें', withGithub: 'GitHub से जारी रखें', or: 'या',
    signInJoinShort: 'साइन इन / जुड़ें', createCircle: 'सर्कल बनाएँ', sharedPasscode: 'साझा पासकोड', yourName: 'आपका नाम', iAm: 'मैं हूँ',
    yourEmailOpt: 'आपका ईमेल (रिमाइंडर के लिए)', openCircle: 'केयर सर्कल खोलें', elderName: 'बुज़ुर्ग का नाम', choosePasscode: 'साझा पासकोड चुनें (कम से कम 6)',
    fMedName: 'दवा का नाम', fDosage: 'खुराक', dosagePh: 'जैसे 500 mg, 1 गोली', fTimes: 'दिन में समय', addTime: '+ समय जोड़ें', fStock: 'बची हुई गोलियाँ',
    fStart: 'शुरू होने की तिथि', fEnd: 'समाप्ति तिथि', fInstructions: 'निर्देश', instrPh: 'जैसे खाने के बाद', fDoctorName: 'डॉक्टर', fSpecialty: 'विशेषज्ञता',
    fDate: 'तारीख', fTime: 'समय', fLocation: 'स्थान', fNotes: 'नोट्स / डॉक्टर से पूछने वाले सवाल', cancel: 'रद्द करें', confirm: 'पुष्टि करें',
    skipTour: 'छोड़ें', back: 'पीछे', next: 'आगे', finish: 'समाप्त',

    role_family: 'परिवार', role_caretaker: 'देखभालकर्ता', role_elder: 'बुज़ुर्ग',
    status_taken: 'ली गई', status_missed: 'छूट गई', status_due: 'अभी लेनी है', status_pending: 'आने वाली', status_skipped: 'छोड़ी गई', status_cleared: 'हटाया गया',
    level_high: 'ज़्यादा', level_medium: 'मध्यम', level_low: 'कम',
    greetMorning: 'सुप्रभात, {name}', greetAfternoon: 'नमस्ते, {name}', greetEvening: 'शुभ संध्या, {name}',
    allDone: 'सब पूरा', noMoreDoses: 'आज कोई खुराक बाकी नहीं', daysCount: '{n} दिन', none: 'कोई नहीं', doneOf: '{total} में से {done} पूरी',
    noDosesToday: 'आज कोई दवा निर्धारित नहीं है। "दवाइयाँ" में जोड़ें।', riskNone: 'आज कोई खुराक बाकी नहीं।', riskAria: '{pct} प्रतिशत जोखिम, {level}',
    insNone: 'सब कुछ ठीक चल रहा है।', insRefill: '{med}: लगभग {days} दिन की ही दवा बची है। दोबारा मंगवाएँ।',
    insPattern: '{time} बजे की खुराक पिछले 2 हफ़्तों में {count} बार छूटी। इसे दिनचर्या के अनुसार किसी बेहतर समय पर रखने पर विचार करें।',
    insAppt: 'आने वाली मुलाक़ात: {doctor}, {date} को {time} बजे।',
    riskSlot: 'हाल में {pct}% बार छूटी', riskHour: 'इस समय अक्सर छूटती है', riskWeekday: 'इस दिन मुश्किल रहती है',
    recordedBy: '{name} ने दर्ज किया', undo: 'पूर्ववत', taken: 'ली गई', skip: 'छोड़ें',
    undoAria: '{time} की {med} पूर्ववत करें', takenAria: '{time} की {med} ली गई चिह्नित करें', skipAria: '{time} की {med} छोड़ी गई चिह्नित करें',
    allDoneToast: 'आज की सभी खुराकें पूरी। बहुत बढ़िया!', markedTaken: '{med} ली गई चिह्नित', markedSkipped: '{med} छोड़ी गई चिह्नित', cleared: 'हटाया गया',
    noSpeech: 'इस ब्राउज़र में सुनने की सुविधा उपलब्ध नहीं है',
    speakLeft: 'नमस्ते {name}। आज अभी ये दवाइयाँ लेनी हैं: {list}।', speakItem: '{med}, {dosage}, {time} बजे', speakDone: 'बहुत बढ़िया {name}। आज की सभी दवाइयाँ पूरी हो गईं।',
    removeTime: 'समय हटाएँ', editMed: '{med} बदलें', medUpdated: 'दवा अपडेट हुई', medAdded: 'दवा जोड़ी गई', asPrescribed: 'डॉक्टर के अनुसार',
    stockLine: '{stock} बची · लगभग {days} दिन', stockUntracked: 'स्टॉक ट्रैक नहीं हो रहा', until: '{date} तक', edit: 'बदलें', delete: 'हटाएँ', deleteMed: '{med} हटाएँ',
    confirmDeleteMed: '{med} और उसका पूरा रिकॉर्ड हटाएँ?', medDeleted: 'दवा हटाई गई', noMeds: 'अभी कोई दवा नहीं। एक जोड़ें, या ऊपर पर्चा पेस्ट करें।',
    rxNothing: 'इस पाठ में कोई दवा नहीं मिली।', rxReview: 'जोड़ने से पहले कृपया जाँच लें:', add: 'जोड़ें', added: 'जोड़ी गई', asNeeded: 'ज़रूरत होने पर', forDays: '{n} दिनों के लिए',
    interactionsTitle: 'दवा जाँच', sev_high: 'ज़रूरी', sev_moderate: 'डॉक्टर से बात करें', sev_low: 'मामूली',
    editAppt: '{doctor} के साथ मुलाक़ात बदलें', apptUpdated: 'मुलाक़ात अपडेट हुई', apptAdded: 'मुलाक़ात जोड़ी गई', deleteAppt: '{doctor} के साथ मुलाक़ात हटाएँ',
    noUpcoming: 'कोई आने वाली मुलाक़ात नहीं।', noPast: 'कोई पिछली मुलाक़ात नहीं।', confirmDeleteAppt: '{doctor} के साथ मुलाक़ात हटाएँ?', apptDeleted: 'मुलाक़ात हटाई गई',
    asstHello: 'नमस्ते {name}! मैं साथी हूँ। मुझसे पूछें कि आज क्या बाकी है, सप्ताह कैसा रहा, या बताएँ कि कोई खुराक ले ली गई है।',
    chip1: 'आज क्या बाकी है?', chip2: 'इस हफ़्ते दवा पालन कैसा रहा?', chip3: 'कौन-सी खुराक छूटने की सबसे ज़्यादा संभावना है?', chip4: 'अगली मुलाक़ात में डॉक्टर से क्या पूछें?',
    actMarkTaken: '{med} ({time}) ली गई चिह्नित करें', actMarkSkipped: '{med} ({time}) छोड़ी गई चिह्नित करें', actAddMed: '{med} जोड़ें, {times} बजे', actAddAppt: 'मुलाक़ात जोड़ें: {doctor}, {date} {time}',
    done: 'हो गया', actionDone: 'हो गया और सेव हुआ', thinking: 'साथी सोच रहा है',
    dosesTaken: 'ली गई खुराकें', dosesMissed: 'छूटी खुराकें', barsAria: 'रोज़ का दवा पालन: {list}', noData: 'अभी कोई डेटा नहीं', noDose: 'कोई खुराक नहीं', noActivity: 'अभी कोई गतिविधि नहीं।',
    wins: 'क्या अच्छा रहा', concerns: 'किन बातों पर ध्यान दें', suggestions: 'सुझाव', summarySent: 'रिपोर्ट {n} सदस्यों को ईमेल की गई',
    actCreated: 'ने {name} के लिए केयर सर्कल बनाया', actJoined: 'केयर सर्कल से जुड़े', actProfile: 'ने स्वास्थ्य प्रोफ़ाइल अपडेट की', actPasscode: 'ने साझा पासकोड बदला',
    actInvited: 'ने {name} को आमंत्रित किया', actMemberEdit: 'ने सदस्य {name} को अपडेट किया', actMemberRemove: 'ने {name} को हटाया', actMedAdd: 'ने {med} जोड़ी ({times})',
    actMedEdit: 'ने {med} बदली', actMedRemove: 'ने {med} हटाई', actDose: '{status}: {med} ({date}, {time})', actApptAdd: 'ने {doctor} के साथ {date} की मुलाक़ात जोड़ी',
    actApptEdit: 'ने {doctor} के साथ मुलाक़ात अपडेट की', actApptRemove: 'ने {doctor} के साथ मुलाक़ात रद्द की',
    emailsOn: 'ईमेल चालू', emailsOff: 'ईमेल बंद', you: 'आप', noEmail: 'ईमेल नहीं', removeMember: '{name} को हटाएँ', remove: 'हटाएँ',
    emailModeSmtp: 'आने वाली और छूटी खुराकों, मुलाक़ातों और दवा ख़त्म होने के रिमाइंडर हर सदस्य की अपनी भाषा में अपने आप ईमेल होते हैं।',
    emailModeDry: 'प्रीव्यू मोड: मेल सर्वर सेट नहीं है, इसलिए रिमाइंडर ईमेल भेजे जाने के बजाय यहाँ दिखते हैं।',
    confirmRemoveMember: '{name} को केयर सर्कल से हटाएँ?', memberRemoved: 'सदस्य हटाया गया', to: 'प्रति', preview: 'प्रीव्यू', outboxEmpty: 'अभी कोई रिमाइंडर नहीं।',
    profileSaved: 'प्रोफ़ाइल सेव हुई', emergencyCard: 'आपातकालीन कार्ड', currentMeds: 'वर्तमान दवाइयाँ', copied: 'केयर कोड कॉपी हुआ', invited: 'आमंत्रण सेव हुआ',
    passcodeChanged: 'पासकोड बदल गया। बाकी सदस्यों को नया पासकोड चाहिए होगा।', remindersSent: '{n} रिमाइंडर भेजे गए',
    sessionEnded: 'आपका सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।', signedOut: 'साइन आउट हो गए', demoReady: 'डेमो तैयार! केयर कोड {code}, पासकोड {pass}।',
    welcomeBack: 'स्वागत है, {name}', oauthFailed: 'साइन-इन विफल रहा। कृपया फिर कोशिश करें।',
    oauthPick: 'नमस्ते {name}, एक केयर सर्कल चुनें:', oauthNoCircle: 'नमस्ते {name}। {email} अभी किसी केयर सर्कल में नहीं है। केयर कोड से जुड़ें या नया सर्कल बनाएँ।',
    genericError: 'कुछ गलत हो गया। कृपया फिर कोशिश करें।', offline: 'आप ऑफ़लाइन लगते हैं। कृपया इंटरनेट कनेक्शन जाँचें।',
    micDenied: 'माइक्रोफ़ोन की अनुमति नहीं मिली।', listening: 'सुन रहा हूँ… रोकने के लिए माइक फिर से दबाएँ।',
    tourStepOf: 'चरण {n} / {total}',
    tourStatsT: 'एक नज़र में आज का दिन', tourStatsD: 'सप्ताह का दवा पालन, अगली खुराक, लगातार पूरे दिन और डॉक्टर से अगली मुलाक़ात।',
    tourTimelineT: 'आज की दवाइयाँ', tourTimelineD: '"ली गई" या "छोड़ें" दबाएँ। सर्कल में सबको तुरंत दिखता है, और खुराक छूटने पर परिवार को ईमेल जाता है।',
    tourRiskT: 'छूटने वाली खुराक का अनुमान', tourRiskD: 'एक छोटा मशीन-लर्निंग मॉडल 4 हफ़्तों के रिकॉर्ड से सीखकर बताता है कि आज किस खुराक पर ख़ास ध्यान देना है।',
    tourRxT: 'पर्चे से शेड्यूल', tourRxD: '"1-0-1 खाने के बाद" जैसा पर्चा पेस्ट करें या बोलें, AI उसे रिमाइंडर शेड्यूल में बदल देगा।',
    tourAssistantT: 'मिलिए साथी से', tourAssistantD: 'हिंदी या अंग्रेज़ी में बोलकर या लिखकर पूछें। आपकी पुष्टि के बाद साथी खुराक दर्ज कर सकता है या मुलाक़ात जोड़ सकता है।',
    tourSummaryT: 'परिवार के लिए साप्ताहिक रिपोर्ट', tourSummaryD: 'एक टैप में सप्ताह की आसान रिपोर्ट बनती है, जिसे पूरे परिवार को ईमेल किया जा सकता है।',
    tourMembersT: 'केयर सर्कल', tourMembersD: 'केयर कोड साझा करें, ईमेल से आमंत्रित करें और चुनें कि रिमाइंडर किसे मिलें। हर सदस्य को उसकी भाषा में ईमेल मिलता है।',
    tourLangT: 'Also in English', tourLangD: 'पूरा ऐप, AI और ईमेल किसी भी समय अंग्रेज़ी या हिंदी में बदलें।',
  },
};

let lang = 'en';
const LOCALE = { en: 'en-IN', hi: 'hi-IN' };

export const getLang = () => lang;
export const speechLang = () => (lang === 'hi' ? 'hi-IN' : 'en-IN');
export function setLang(l) {
  lang = DICT[l] ? l : 'en';
  document.documentElement.lang = lang;
}
export function initialLang(saved) {
  if (saved && DICT[saved]) return saved;
  return (navigator.languages || [navigator.language || 'en']).some((x) => x.toLowerCase().startsWith('hi')) ? 'hi' : 'en';
}

export function t(key, params = {}) {
  const str = DICT[lang][key] ?? DICT.en[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : ''));
}

/** Translate static markup: data-i18n (text), data-i18n-placeholder, data-i18n-aria (aria-label). */
export function applyTranslations(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  for (const node of root.querySelectorAll('[data-i18n-aria]')) node.setAttribute('aria-label', t(node.dataset.i18nAria));
  document.title = t('docTitle');
}

// ---- formatting ----
const cache = new Map();
function fmt(opts) {
  const k = `${lang}|${JSON.stringify(opts)}`;
  if (!cache.has(k)) cache.set(k, new Intl.DateTimeFormat(LOCALE[lang], opts));
  return cache.get(k);
}
const asDate = (iso) => new Date(`${iso}T00:00:00`);

/** "08:30" -> "8:30 am". With compact=true the period goes on a second line (timeline badge). */
export function fmtTime(hhmm, compact = false) {
  const [h, m] = hhmm.split(':').map(Number);
  const s = fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, h, m));
  if (!compact) return s;
  const i = s.lastIndexOf(' ');
  return i > 0 ? `${s.slice(0, i)}\n${s.slice(i + 1)}` : s;
}
export const fmtDate = (iso) => fmt({ day: 'numeric', month: 'short' }).format(asDate(iso));
export const fmtLongDate = (iso) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(asDate(iso));
export const fmtDateTime = (isoTs) => fmt({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(isoTs));
export const monthShort = (d) => fmt({ month: 'short' }).format(d);
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const greetingKey = (minutes) => (minutes < 12 * 60 ? 'greetMorning' : minutes < 17 * 60 ? 'greetAfternoon' : 'greetEvening');

export { DICT };
