'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const state = { token: null, me: null, profile: null, today: [] };
  const STATUS_LABEL = { taken: 'Taken', missed: 'Missed', due: 'Due now', pending: 'Upcoming', skipped: 'Skipped' };

  // ---------- helpers ----------
  function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }
  let toastTimer;
  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg; t.className = `toast${isError ? ' error' : ''}`; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { return null; } return null; }
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401 && state.token) { signOut(); throw new Error('Your session expired. Please sign in again.'); }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  function formData(form) {
    return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  }
  function handle(form, fn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try { await fn(formData(form)); } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
    });
  }
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const prettyDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // ---------- display preferences ----------
  function applyPrefs() {
    for (const [cls, btn] of [['large', '#textSize'], ['contrast', '#contrast']]) {
      const on = store(`cc-${cls}`) === '1';
      document.documentElement.classList.toggle(cls, on);
      $(btn).setAttribute('aria-pressed', String(on));
    }
  }
  $('#textSize').addEventListener('click', () => { store('cc-large', store('cc-large') === '1' ? '0' : '1'); applyPrefs(); });
  $('#contrast').addEventListener('click', () => { store('cc-contrast', store('cc-contrast') === '1' ? '0' : '1'); applyPrefs(); });

  // ---------- auth ----------
  function startSession(s) {
    state.token = s.token; store('cc-token', s.token);
    loadAll().catch((e) => toast(e.message, true));
  }
  function signOut() {
    state.token = null; store('cc-token', null);
    $('#appView').hidden = true; $('#authView').hidden = false; $('#logout').hidden = true;
  }
  $('#logout').addEventListener('click', signOut);
  handle($('#joinForm'), async (b) => { startSession(await api('/api/login', { method: 'POST', body: b })); toast('Welcome back'); });
  handle($('#createForm'), async (b) => {
    const s = await api('/api/profiles', { method: 'POST', body: b });
    startSession(s);
    toast(`Care circle created. Your care code is ${s.profileId} — share it with family along with the passcode.`);
  });

  // ---------- tabs (WAI-ARIA pattern) ----------
  const tabs = [...document.querySelectorAll('[role=tab]')];
  function selectTab(tab) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    }
    tab.focus();
    if (tab.id === 'tab-health') renderProgress().catch((e) => toast(e.message, true));
    if (tab.id === 'tab-circle') renderOutbox().catch(() => {});
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (e.key in map) { e.preventDefault(); selectTab(tabs[(map[e.key] + tabs.length) % tabs.length]); }
    });
  });

  // ---------- load & render ----------
  async function loadAll() {
    const me = await api('/api/me');
    state.me = me.member; state.profile = me.profile;
    $('#authView').hidden = true; $('#appView').hidden = false; $('#logout').hidden = false;
    $('#who').textContent = `${state.profile.name}'s care circle`;
    $('#codeLine').textContent = `Signed in as ${state.me.name} (${state.me.role}) · Care code: ${state.profile.id}`;
    $('#emailMode').textContent = me.emailMode === 'smtp'
      ? 'Email reminders are sent automatically for upcoming and missed doses, appointments and refills.'
      : 'Demo mode: no mail server configured, so reminders appear in the outbox below instead of being emailed.';
    renderMeds(); renderAppts(); renderProfile(); renderMembers();
    await renderToday();
    $('#main').focus();
  }

  async function renderToday() {
    const [{ items }, ins] = await Promise.all([api('/api/schedule'), api('/api/insights')]);
    state.today = items;
    const list = $('#todayList'); list.replaceChildren();
    if (!items.length) list.append(el('li', {}, 'No medicines scheduled today. Add them in the Medications tab.'));
    for (const s of items) {
      const done = s.status === 'taken' || s.status === 'skipped';
      list.append(el('li', {},
        el('span', { class: 'time' }, s.time),
        el('div', { class: 'info' },
          el('strong', {}, s.name), ` ${s.dosage || ''}`,
          s.instructions ? el('div', { class: 'muted' }, s.instructions) : null,
          s.recordedBy ? el('div', { class: 'muted' }, `Recorded by ${s.recordedBy}`) : null),
        el('span', { class: `badge s-${s.status}` }, STATUS_LABEL[s.status]),
        el('div', { class: 'actions' },
          done
            ? el('button', { type: 'button', onclick: () => mark(s, 'undo'), 'aria-label': `Undo ${s.name} at ${s.time}` }, 'Undo')
            : [
              el('button', { type: 'button', class: 'primary', onclick: () => mark(s, 'taken'), 'aria-label': `Mark ${s.name} at ${s.time} as taken` }, 'Taken'),
              el('button', { type: 'button', onclick: () => mark(s, 'skipped'), 'aria-label': `Mark ${s.name} at ${s.time} as skipped` }, 'Skip'),
            ])));
    }
    const il = $('#insightList'); il.replaceChildren(...ins.map((i) => el('p', { class: `insight ${i.level}` }, i.text)));
    const upcoming = state.profile.appointments.find((a) => a.date >= todayStr());
    $('#nextAppt').replaceChildren(upcoming
      ? el('p', { class: 'insight' }, `${prettyDate(upcoming.date)} at ${upcoming.time} — ${upcoming.doctor}${upcoming.location ? `, ${upcoming.location}` : ''}`)
      : el('p', { class: 'muted' }, 'No upcoming appointments.'));
  }
  async function mark(s, status) {
    try {
      await api('/api/doses', { method: 'POST', body: { medId: s.medId, date: s.date, time: s.time, status } });
      toast(status === 'undo' ? 'Cleared' : `${s.name} marked ${status}`);
      await refreshProfile(); await renderToday();
    } catch (e) { toast(e.message, true); }
  }
  async function refreshProfile() { state.profile = (await api('/api/me')).profile; renderMeds(); }

  $('#readAloud').addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return toast('Read aloud is not supported in this browser', true);
    const pending = state.today.filter((s) => !['taken', 'skipped'].includes(s.status));
    const text = pending.length
      ? `Hello ${state.profile.name}. Today you still need: ${pending.map((s) => `${s.name}, ${s.dosage || ''}, at ${s.time}`).join('. ')}.`
      : `Well done ${state.profile.name}. All of today's medicines are done.`;
    speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  });

  // ---------- medications ----------
  const medForm = $('#medForm');
  function resetMedForm() { medForm.reset(); medForm.elements.id.value = ''; $('#medFormTitle').textContent = 'Add a medication'; $('#medCancel').hidden = true; }
  $('#medCancel').addEventListener('click', resetMedForm);
  handle(medForm, async (b) => {
    const body = { ...b, times: b.times.split(/[,\s]+/).filter(Boolean), stock: b.stock === '' ? null : Number(b.stock) };
    const editing = body.id; delete body.id;
    await api(editing ? `/api/medications/${editing}` : '/api/medications', { method: editing ? 'PUT' : 'POST', body });
    toast(editing ? 'Medication updated' : 'Medication added'); resetMedForm();
    await refreshProfile(); await renderToday();
  });
  function renderMeds() {
    const list = $('#medList'); list.replaceChildren();
    if (!state.profile.medications.length) list.append(el('li', {}, 'No medications yet.'));
    for (const m of state.profile.medications) {
      list.append(el('li', {},
        el('div', {},
          el('strong', {}, m.name), ` ${m.dosage || ''}`,
          el('div', { class: 'muted' }, `At ${m.times.join(', ')}${m.instructions ? ` · ${m.instructions}` : ''}${m.endDate ? ` · until ${m.endDate}` : ''}`),
          m.stock !== null ? el('div', { class: m.daysLeft <= 3 ? 'badge s-due' : 'muted' }, `${m.stock} in stock (~${m.daysLeft} days)`) : null),
        el('div', { class: 'actions' },
          el('button', { type: 'button', onclick: () => editMed(m), 'aria-label': `Edit ${m.name}` }, 'Edit'),
          el('button', { type: 'button', class: 'danger', onclick: () => delMed(m), 'aria-label': `Delete ${m.name}` }, 'Delete'))));
    }
  }
  function editMed(m) {
    const f = medForm.elements;
    f.id.value = m.id; f.name.value = m.name; f.dosage.value = m.dosage || ''; f.times.value = m.times.join(', ');
    f.stock.value = m.stock ?? ''; f.startDate.value = m.startDate || ''; f.endDate.value = m.endDate || ''; f.instructions.value = m.instructions || '';
    $('#medFormTitle').textContent = `Edit ${m.name}`; $('#medCancel').hidden = false; f.name.focus();
  }
  async function delMed(m) {
    if (!confirm(`Delete ${m.name} and its history?`)) return;
    try { await api(`/api/medications/${m.id}`, { method: 'DELETE' }); toast('Medication deleted'); await refreshProfile(); await renderToday(); } catch (e) { toast(e.message, true); }
  }

  // ---------- appointments ----------
  const apptForm = $('#apptForm');
  function resetApptForm() { apptForm.reset(); apptForm.elements.id.value = ''; $('#apptFormTitle').textContent = 'Add an appointment'; $('#apptCancel').hidden = true; }
  $('#apptCancel').addEventListener('click', resetApptForm);
  handle(apptForm, async (b) => {
    const editing = b.id; delete b.id;
    await api(editing ? `/api/appointments/${editing}` : '/api/appointments', { method: editing ? 'PUT' : 'POST', body: b });
    toast(editing ? 'Appointment updated' : 'Appointment added'); resetApptForm();
    state.profile.appointments = await api('/api/appointments'); renderAppts(); await renderToday();
  });
  function renderAppts() {
    const list = $('#apptList'); list.replaceChildren();
    if (!state.profile.appointments.length) list.append(el('li', {}, 'No appointments yet.'));
    const today = todayStr();
    for (const a of state.profile.appointments) {
      list.append(el('li', {},
        el('div', {},
          el('strong', {}, `${prettyDate(a.date)} at ${a.time}`), a.date < today ? el('span', { class: 'badge s-skipped' }, ' Past') : null,
          el('div', {}, `${a.doctor}${a.specialty ? ` · ${a.specialty}` : ''}${a.location ? ` · ${a.location}` : ''}`),
          a.notes ? el('div', { class: 'muted' }, a.notes) : null),
        el('div', { class: 'actions' },
          el('button', { type: 'button', onclick: () => editAppt(a), 'aria-label': `Edit appointment with ${a.doctor}` }, 'Edit'),
          el('button', { type: 'button', class: 'danger', onclick: () => delAppt(a), 'aria-label': `Cancel appointment with ${a.doctor}` }, 'Delete'))));
    }
  }
  function editAppt(a) {
    const f = apptForm.elements;
    f.id.value = a.id; f.doctor.value = a.doctor; f.specialty.value = a.specialty || ''; f.date.value = a.date; f.time.value = a.time;
    f.location.value = a.location || ''; f.notes.value = a.notes || '';
    $('#apptFormTitle').textContent = `Edit appointment with ${a.doctor}`; $('#apptCancel').hidden = false; f.doctor.focus();
  }
  async function delAppt(a) {
    if (!confirm(`Delete the appointment with ${a.doctor}?`)) return;
    try { await api(`/api/appointments/${a.id}`, { method: 'DELETE' }); state.profile.appointments = await api('/api/appointments'); renderAppts(); await renderToday(); toast('Appointment deleted'); } catch (e) { toast(e.message, true); }
  }

  // ---------- progress ----------
  async function renderProgress() {
    const [ad, act] = await Promise.all([api('/api/adherence?days=7'), api('/api/activity')]);
    $('#adherenceSummary').replaceChildren(
      el('div', { class: 'stat' }, el('strong', {}, ad.rate === null ? '—' : `${ad.rate}%`), 'doses taken'),
      el('div', { class: 'stat' }, el('strong', {}, `${ad.taken}/${ad.total}`), 'taken / due'),
      el('div', { class: 'stat' }, el('strong', {}, ad.streak), 'day perfect streak'));
    const chart = $('#adherenceChart');
    chart.setAttribute('aria-label', `Daily adherence: ${ad.daily.map((d) => `${d.date} ${d.rate === null ? 'no doses' : `${d.rate}%`}`).join(', ')}`);
    chart.replaceChildren(...ad.daily.map((d) => el('div', { class: 'bar', 'aria-hidden': 'true' },
      el('span', {}, d.rate === null ? '–' : `${d.rate}%`),
      (() => { const f = el('span', { class: 'fill' }); f.style.height = `${d.rate || 0}%`; return f; })(),
      el('span', {}, d.date.slice(5)))));
    $('#perMed').replaceChildren(...(ad.perMed.length ? ad.perMed.map((m) => el('li', {}, el('strong', {}, m.name), m.rate === null ? 'No data yet' : `${m.rate}% taken`)) : [el('li', {}, 'No data yet.')]));
    $('#activity').replaceChildren(...act.map((a) => el('li', {}, `${new Date(a.at).toLocaleString()} — ${a.by}: ${a.text}`)));
  }

  // ---------- profile & circle ----------
  const profileForm = $('#profileForm');
  function renderProfile() {
    const p = state.profile; const f = profileForm.elements;
    for (const k of ['name', 'dob', 'conditions', 'allergies', 'emergencyContact', 'doctorContact']) f[k].value = p[k] || '';
  }
  handle(profileForm, async (b) => {
    const p = await api('/api/profile', { method: 'PUT', body: b });
    state.profile = p; renderProfile(); $('#who').textContent = `${p.name}'s care circle`; toast('Profile saved');
  });
  $('#printCard').addEventListener('click', () => {
    const p = state.profile;
    $('#emergencyCard').replaceChildren(
      el('h1', {}, `Emergency card — ${p.name}`),
      el('p', {}, `Date of birth: ${p.dob || '—'}`),
      el('p', {}, `Conditions: ${p.conditions || '—'}`),
      el('p', {}, `Allergies: ${p.allergies || '—'}`),
      el('p', {}, `Emergency contact: ${p.emergencyContact || '—'}`),
      el('p', {}, `Doctor: ${p.doctorContact || '—'}`),
      el('h2', {}, 'Current medications'),
      el('ul', {}, ...p.medications.filter((m) => m.active !== false).map((m) => el('li', {}, `${m.name} ${m.dosage || ''} at ${m.times.join(', ')}`))));
    window.print();
  });
  function renderMembers() {
    const list = $('#memberList'); list.replaceChildren();
    for (const m of state.profile.members) {
      const isMe = m.id === state.me.id;
      list.append(el('li', {},
        el('div', {}, el('strong', {}, `${m.name}${isMe ? ' (you)' : ''}`), el('div', { class: 'muted' }, `${m.role}${m.email ? ` · ${m.email}` : ' · no email'}`)),
        el('div', { class: 'actions' },
          el('button', { type: 'button', 'aria-pressed': String(m.notify !== false), onclick: () => toggleNotify(m), 'aria-label': `Email reminders for ${m.name}` }, m.notify !== false ? 'Emails on' : 'Emails off'),
          isMe ? null : el('button', { type: 'button', class: 'danger', onclick: () => removeMember(m), 'aria-label': `Remove ${m.name}` }, 'Remove'))));
    }
  }
  async function toggleNotify(m) {
    try { await api(`/api/members/${m.id}`, { method: 'PUT', body: { notify: m.notify === false } }); await refreshProfile(); renderMembers(); } catch (e) { toast(e.message, true); }
  }
  async function removeMember(m) {
    if (!confirm(`Remove ${m.name} from the care circle?`)) return;
    try { await api(`/api/members/${m.id}`, { method: 'DELETE' }); await refreshProfile(); renderMembers(); toast('Member removed'); } catch (e) { toast(e.message, true); }
  }
  handle($('#passForm'), async (b) => {
    const s = await api('/api/profile/passcode', { method: 'PUT', body: b });
    state.token = s.token; store('cc-token', s.token); $('#passForm').reset(); toast('Passcode changed');
  });
  async function renderOutbox() {
    const { messages } = await api('/api/reminders/outbox');
    $('#outbox').replaceChildren(...messages.map((m) => el('li', {}, el('strong', {}, m.subject), el('div', { class: 'muted' }, `To ${m.to}`))));
  }
  $('#runReminders').addEventListener('click', async () => {
    try { const { sent } = await api('/api/reminders/run', { method: 'POST' }); toast(`${sent} reminder(s) sent`); await renderOutbox(); } catch (e) { toast(e.message, true); }
  });

  // ---------- boot ----------
  applyPrefs();
  $('#cDob').max = todayStr();
  const saved = store('cc-token');
  if (saved) { state.token = saved; loadAll().catch(() => signOut()); }
  setInterval(() => { if (state.token && !$('#panel-today').hidden) renderToday().catch(() => {}); }, 60000);
})();
