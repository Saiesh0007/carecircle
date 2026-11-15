// Guided product tour: spotlights real UI elements step by step. Keyboard: ←/→, Esc.
import { $ } from './ui.js';
import { t } from './i18n.js';

const STEPS = [
  { view: 'today', target: '[data-tour="stats"]', key: 'tourStats' },
  { view: 'today', target: '[data-tour="timeline"]', key: 'tourTimeline' },
  { view: 'today', target: '[data-tour="risk"]', key: 'tourRisk' },
  { view: 'meds', target: '[data-tour="rx"]', key: 'tourRx' },
  { view: 'assistant', target: '#view-assistant .chat', key: 'tourAssistant' },
  { view: 'progress', target: '[data-tour="summary"]', key: 'tourSummary' },
  { view: 'circle', target: '[data-tour="members"]', key: 'tourMembers' },
  { view: null, target: '.lang-switch', key: 'tourLang' },
];

let index = 0; let showView = () => {}; let lastFocus = null; let active = false;

function place() {
  const step = STEPS[index];
  const target = document.querySelector(step.target);
  const spot = $('#tourSpot'); const card = $('#tourCard');
  $('#tourStep').textContent = t('tourStepOf', { n: index + 1, total: STEPS.length });
  $('#tourTitle').textContent = t(`${step.key}T`);
  $('#tourBody').textContent = t(`${step.key}D`);
  $('#tourBack').disabled = index === 0;
  $('#tourNext').textContent = index === STEPS.length - 1 ? t('finish') : t('next');
  if (!target) { spot.style.opacity = '0'; card.style.top = '30%'; card.style.left = `${Math.max(16, innerWidth / 2 - 180)}px`; return; }
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
  requestAnimationFrame(() => {
    const r = target.getBoundingClientRect();
    const pad = 8;
    spot.style.opacity = '1';
    spot.style.top = `${r.top - pad}px`; spot.style.left = `${r.left - pad}px`;
    spot.style.width = `${r.width + pad * 2}px`; spot.style.height = `${Math.min(r.height + pad * 2, innerHeight - 40)}px`;
    const cw = Math.min(360, innerWidth - 32);
    const ch = card.offsetHeight || 200;
    let top = r.bottom + 16;
    if (top + ch > innerHeight - 16) top = Math.max(16, r.top - ch - 16);
    if (top < 16 || (top + ch > innerHeight - 16)) top = Math.max(16, innerHeight - ch - 90);
    const left = Math.min(Math.max(16, r.left), innerWidth - cw - 16);
    card.style.top = `${top}px`; card.style.left = `${left}px`;
  });
}

function go(i) {
  if (i < 0) return;
  if (i >= STEPS.length) { end(); return; }
  index = i;
  const step = STEPS[index];
  if (step.view) showView(step.view);
  setTimeout(place, 60);
}

function onKey(e) {
  if (!active) return;
  if (e.key === 'Escape') end();
  else if (e.key === 'ArrowRight') go(index + 1);
  else if (e.key === 'ArrowLeft') go(index - 1);
}

export function end() {
  active = false;
  $('#tour').hidden = true;
  document.removeEventListener('keydown', onKey);
  removeEventListener('resize', place);
  try { localStorage.setItem('cc-tour-done', '1'); } catch { /* storage unavailable */ }
  lastFocus?.focus?.();
}

export function startTour(viewSwitcher) {
  showView = viewSwitcher;
  lastFocus = document.activeElement;
  active = true;
  $('#tour').hidden = false;
  document.addEventListener('keydown', onKey);
  addEventListener('resize', place);
  go(0);
  $('#tourNext').focus();
}

export function initTour() {
  $('#tourNext').addEventListener('click', () => go(index + 1));
  $('#tourBack').addEventListener('click', () => go(index - 1));
  $('#tourSkip').addEventListener('click', end);
}

export function tourSeen() { try { return localStorage.getItem('cc-tour-done') === '1'; } catch { return false; } }
export function refreshTour() { if (active) place(); }
