// CareCircle web app controller: preferences, language, auth (passcode / demo / OAuth), routing and views.
import { $, $$, busy, toast, formData, enableTilt, transition, motionOK } from './ui.js';
import { api, session } from './api.js';
import { t, setLang, getLang, applyTranslations, initialLang } from './i18n.js';
import { attachMic } from './voice.js';
import { initTour, startTour, tourSeen, refreshTour } from './tour.js';
import { createToday } from './views/today.js';
import { createMeds } from './views/meds.js';
import { createAppts } from './views/appts.js';
import { createAssistant } from './views/assistant.js';
import { createProgress } from './views/progress.js';
import { createCircle } from './views/circle.js';

const VIEWS = ['today', 'meds', 'appts', 'assistant', 'progress', 'circle'];
const state = {
  member: null,
  profile: null,
  config: { ai: false, oauth: [], emailMode: 'dry-run' },
  view: 'today',
};

/** Read (one argument) or write (two arguments) a saved preference. */
function pref(key, value) {
  try {
    if (value === undefined) {
      return localStorage.getItem(key);
    }
    localStorage.setItem(key, value);
  } catch {
    /* private mode: preferences simply won't persist */
  }
  return null;
}

// ---------------- Display preferences ----------------
const PREFS = [
  ['#textSize', 'large'],
  ['#contrast', 'contrast'],
  ['#motion', 'no-motion'],
];
/** Reflect saved display preferences on <html> classes and the toggle buttons. */
function applyPrefs() {
  for (const [sel, cls] of PREFS) {
    const on = pref(`cc-${cls}`) === '1';
    document.documentElement.classList.toggle(cls, on);
    $(sel).setAttribute('aria-pressed', String(on));
  }
}
for (const [sel, cls] of PREFS) {
  $(sel).addEventListener('click', () => {
    pref(`cc-${cls}`, pref(`cc-${cls}`) === '1' ? '0' : '1');
    applyPrefs();
    refreshTour();
  });
}

// ---------------- Views ----------------
const ctx = { state, refresh, onDataChanged: () => refreshProfile() };
const today = createToday(ctx);
const meds = createMeds(ctx);
const appts = createAppts(ctx);
const assistant = createAssistant(ctx);
const progress = createProgress();
const circle = createCircle(ctx);

/** Re-render every view that depends on the profile (after data or language changes). */
function renderAll() {
  if (!state.profile) {
    return;
  }
  const p = state.profile;
  $('#circleChip').replaceChildren();
  const av = document.createElement('span');
  av.className = 'avatar';
  av.textContent = p.name.slice(0, 1);
  const info = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = p.name;
  const small = document.createElement('small');
  small.textContent = `${state.member.name} · ${t(`role_${state.member.role}`)}`;
  info.append(strong, small);
  $('#circleChip').append(av, info);
  $('#demoBanner').hidden = !p.demo;
  today.render();
  meds.render();
  appts.render();
  circle.render();
}

/** Reload the signed-in member and circle, then re-render. */
async function refreshProfile() {
  const me = await api('/api/me');
  state.member = me.member;
  state.profile = me.profile;
  renderAll();
}

/** Reload the profile and today's schedule (and progress when it is visible). */
async function refresh() {
  await Promise.all([refreshProfile(), today.load()]);
  if (state.view === 'progress') {
    await progress.load();
  }
}

/** Switch the visible view, update navigation state and the URL hash, and load view data. */
function showView(requested, { focus = false } = {}) {
  const name = VIEWS.includes(requested) ? requested : 'today';
  state.view = name;
  transition(() => {
    for (const v of VIEWS) {
      $(`#view-${v}`).hidden = v !== name;
    }
    for (const a of $$('.sidenav a')) {
      if (a.dataset.view === name) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    }
  });
  if (location.hash !== `#${name}`) {
    history.replaceState(null, '', `#${name}`);
  }
  if (name === 'progress') {
    progress.load().catch((e) => toast(e.message, { error: true }));
  }
  if (name === 'circle') {
    circle.loadOutbox().catch(() => {});
  }
  if (name === 'assistant' && !$('#chatLog').children.length) {
    assistant.greet();
  }
  if (focus) {
    $(`#view-${name} h2`)?.setAttribute('tabindex', '-1');
  }
  if (focus) {
    $(`#view-${name} h2`)?.focus();
  }
  window.scrollTo({ top: 0, behavior: motionOK() ? 'smooth' : 'auto' });
}
for (const a of $$('.sidenav a')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    showView(a.dataset.view, { focus: true });
  });
}
addEventListener('hashchange', () => {
  if (state.profile) {
    showView(location.hash.slice(1));
  }
});

// ---------------- Session ----------------
async function enterApp({ fresh = false } = {}) {
  await refreshProfile();
  $('#landing').hidden = true;
  $('#app').hidden = false;
  $('#logout').hidden = false;
  $('#tourBtn').hidden = false;
  if ($('#authDialog').open) {
    $('#authDialog').close();
  }
  await today.load();
  assistant.greet();
  const initial = location.hash.slice(1);
  showView(VIEWS.includes(initial) ? initial : 'today');
  if (state.member.lang && state.member.lang !== getLang() && fresh) {
    syncLangToServer();
  }
  if (state.profile.demo && (fresh || !tourSeen())) {
    setTimeout(() => startTour(showView), 700);
  }
}

/** Forget the session locally and on the server, and return to the landing page. */
function signOut() {
  session.set(null);
  state.member = null;
  state.profile = null;
  $('#app').hidden = true;
  $('#landing').hidden = false;
  $('#logout').hidden = true;
  $('#tourBtn').hidden = true;
  history.replaceState(null, '', '/');
  api('/api/oauth/logout', { method: 'POST' }).catch(() => {});
}
session.onExpired(() => {
  if (state.profile) {
    signOut();
    toast(t('sessionEnded'), { error: true });
  }
});
$('#logout').addEventListener('click', () => {
  signOut();
  toast(t('signedOut'));
});

/** Run a sign-in request (passcode, demo or OAuth), store the token and enter the app. */
async function startSession(promise, button) {
  await busy(button, async () => {
    const s = await promise();
    session.set(s.token);
    await enterApp({ fresh: true });
    if (s.passcode) {
      toast(t('demoReady', { code: s.profileId, pass: s.passcode }), { ms: 7000 });
    } else {
      toast(t('welcomeBack', { name: s.member.name }));
    }
  });
}

// ---------------- Auth dialog ----------------
const authDlg = $('#authDialog');
/** Select the sign-in or create tab in the auth dialog (ARIA tabs pattern). */
function authTab(which) {
  const signin = which === 'signin';
  $('#tabSignin').setAttribute('aria-selected', String(signin));
  $('#tabSignin').tabIndex = signin ? 0 : -1;
  $('#tabCreate').setAttribute('aria-selected', String(!signin));
  $('#tabCreate').tabIndex = signin ? -1 : 0;
  $('#joinForm').hidden = !signin;
  $('#createForm').hidden = signin;
}
/** Open the auth dialog on the given tab. */
function openAuth(which = 'signin') {
  authTab(which);
  authDlg.showModal();
}
$$('[data-open-auth]').forEach((b) =>
  b.addEventListener('click', () => openAuth(b.dataset.openAuth)),
);
$('#tabSignin').addEventListener('click', () => authTab('signin'));
$('#tabCreate').addEventListener('click', () => authTab('create'));
for (const tab of [$('#tabSignin'), $('#tabCreate')]) {
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const other = tab.id === 'tabSignin' ? $('#tabCreate') : $('#tabSignin');
      other.click();
      other.focus();
    }
  });
}
$('#joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const body = { ...formData(e.currentTarget), lang: getLang() };
  startSession(
    () => api('/api/login', { method: 'POST', body }),
    e.currentTarget.querySelector('[type=submit]'),
  );
});
$('#createForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const body = { ...formData(e.currentTarget), lang: getLang() };
  startSession(
    () => api('/api/profiles', { method: 'POST', body }),
    e.currentTarget.querySelector('[type=submit]'),
  );
});
$('#demoBtn').addEventListener('click', (e) =>
  startSession(
    () => api('/api/demo', { method: 'POST', body: { lang: getLang() } }),
    e.currentTarget,
  ),
);
$('#tourBtn').addEventListener('click', () => startTour(showView));
$('#demoTour').addEventListener('click', () => startTour(showView));

// ---------------- OAuth ----------------
async function handleOAuthReturn() {
  const params = new URLSearchParams(location.search);
  const status = params.get('oauth');
  if (!status) {
    return;
  }
  history.replaceState(null, '', location.pathname + location.hash);
  if (status !== 'ok') {
    toast(t('oauthFailed'), { error: true });
    return;
  }
  const { identity, circles } = await api('/api/oauth/identity');
  if (!identity) {
    return;
  }
  if (circles.length === 1) {
    await startSession(() =>
      api('/api/oauth/enter', {
        method: 'POST',
        body: { profileId: circles[0].profileId, lang: getLang() },
      }),
    );
    return;
  }
  const box = $('#oauthIdentity');
  box.replaceChildren();
  const p = document.createElement('p');
  p.textContent = circles.length
    ? t('oauthPick', { name: identity.name })
    : t('oauthNoCircle', { name: identity.name, email: identity.email });
  box.append(p);
  for (const c of circles) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn primary block';
    b.textContent = `${c.name} · ${t(`role_${c.role}`)}`;
    b.addEventListener('click', () =>
      startSession(
        () =>
          api('/api/oauth/enter', {
            method: 'POST',
            body: { profileId: c.profileId, lang: getLang() },
          }),
        b,
      ),
    );
    box.append(b);
  }
  box.hidden = false;
  for (const f of ['#jName', '#cYour']) {
    $(f).value = identity.name;
  }
  for (const f of ['#jEmail', '#cEmail']) {
    $(f).value = identity.email;
  }
  openAuth('signin');
}

// ---------------- Language ----------------
function syncLangToServer() {
  if (state.profile) {
    api('/api/me', { method: 'PUT', body: { lang: getLang() } }).catch(() => {});
  }
}
/** Change the UI language everywhere and remember it for this member's emails. */
function switchLang(lang) {
  setLang(lang);
  pref('cc-lang', lang);
  for (const b of $$('.lang-switch button')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
  applyTranslations();
  if (state.profile) {
    renderAll();
    if (state.view === 'progress') {
      progress.load().catch(() => {});
    }
    if (!$('#chatLog').children.length || $('#chatLog').children.length === 1) {
      assistant.greet();
    }
    syncLangToServer();
  }
  refreshTour();
}
$$('.lang-switch button').forEach((b) =>
  b.addEventListener('click', () => switchLang(b.dataset.lang)),
);

// ---------------- Landing 3D parallax ----------------
function initScene() {
  const scene = $('#scene');
  const inner = $('#sceneInner');
  if (!scene) {
    return;
  }
  addEventListener(
    'pointermove',
    (e) => {
      if (!motionOK() || $('#landing').hidden || e.pointerType === 'touch') {
        return;
      }
      const x = e.clientX / innerWidth - 0.5;
      const y = e.clientY / innerHeight - 0.5;
      inner.style.setProperty('--ry', `${(-14 + x * 16).toFixed(2)}deg`);
      inner.style.setProperty('--rx', `${(8 - y * 10).toFixed(2)}deg`);
    },
    { passive: true },
  );
}

// ---------------- Boot ----------------
async function boot() {
  applyPrefs();
  const lang = initialLang(pref('cc-lang'));
  switchLang(lang);
  initTour();
  initScene();
  enableTilt();
  for (const b of $$('[data-mic-for]')) {
    attachMic(b, $(`#${b.dataset.micFor}`));
  }
  try {
    state.config = await api('/api/config');
  } catch {
    /* offline: keep defaults */
  }
  for (const n of $$('[data-ai]')) {
    n.hidden = !state.config.ai;
  }
  if (!state.config.ai) {
    for (const b of $$('[data-mic-for]')) {
      b.hidden = true;
    }
  }
  const oauth = state.config.oauth || [];
  $('#oauthBox').hidden = !oauth.length;
  $('#oauthGoogle').hidden = !oauth.includes('google');
  $('#oauthGithub').hidden = !oauth.includes('github');
  $('#cDob').max = new Date().toISOString().slice(0, 10);

  await handleOAuthReturn().catch((e) => toast(e.message, { error: true }));
  if (!state.profile && session.load()) {
    try {
      await enterApp();
    } catch {
      session.set(null);
    }
  }
  setInterval(() => {
    if (state.profile && state.view === 'today' && document.visibilityState === 'visible') {
      today.load().catch(() => {});
    }
  }, 60000);
}

boot();
