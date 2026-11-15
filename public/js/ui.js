// Small DOM + interaction helpers shared by every view.
import { t } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Hyperscript-style element builder. Text is always set as text (never HTML) to prevent XSS. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'vars') for (const [p, val] of Object.entries(v)) node.style.setProperty(p, val);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function svg(path, viewBox = '0 0 24 24') {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  s.append(p);
  return s;
}
export const ICON = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  skip: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l9-9a5 5 0 0 1 7 7zM8 9l7 7',
};

export const motionOK = () => !document.documentElement.classList.contains('no-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches;

export function toast(message, { error = false, ms = 4200 } = {}) {
  const box = $('#toasts');
  const node = el('div', { class: `toast${error ? ' error' : ''}`, role: error ? 'alert' : null }, message);
  box.append(node);
  setTimeout(() => { node.classList.add('out'); setTimeout(() => node.remove(), 320); }, ms);
}

/** Show a spinner on a button while an async task runs; errors become toasts. */
export async function busy(button, task) {
  if (button) { button.classList.add('busy'); button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try { return await task(); } catch (e) { toast(e.message || t('genericError'), { error: true }); return undefined; } finally {
    if (button) { button.classList.remove('busy'); button.disabled = false; button.removeAttribute('aria-busy'); }
  }
}

export function confirmDialog(text, { danger = true, yes } = {}) {
  const dlg = $('#confirmDialog');
  $('#confirmText').textContent = text;
  const yesBtn = $('#confirmYes');
  yesBtn.textContent = yes || t('confirm');
  yesBtn.className = `btn ${danger ? 'danger' : 'primary'}`;
  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); yesBtn.onclick = null; $('#confirmNo').onclick = null; resolve(v); };
    yesBtn.onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
    dlg.addEventListener('cancel', () => resolve(false), { once: true });
    dlg.showModal();
  });
}

export function formData(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}

/** Gentle 3D tilt following the pointer (mouse/pen only; disabled with reduced motion). */
export function enableTilt(root = document) {
  for (const card of $$('.tilt', root)) {
    if (card.dataset.tiltOn) continue;
    card.dataset.tiltOn = '1';
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !motionOK()) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ty', `${(x * 8).toFixed(2)}deg`);
      card.style.setProperty('--tx', `${(-y * 8).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--tx', '0deg'); card.style.setProperty('--ty', '0deg'); });
  }
}

export function confetti(origin) {
  if (!motionOK()) return;
  const r = origin?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const colors = ['#0e6f62', '#e59a2f', '#b8432f', '#2c7a4b', '#5cc8b4'];
  for (let i = 0; i < 28; i++) {
    const c = el('span', {
      class: 'confetti',
      vars: {
        '--dx': `${(Math.random() - 0.5) * 320}px`, '--dy': `${-80 - Math.random() * 220}px`, '--rot': `${Math.random() * 720}deg`,
      },
    });
    c.style.left = `${r.left + r.width / 2}px`;
    c.style.top = `${r.top + r.height / 2}px`;
    c.style.background = colors[i % colors.length];
    document.body.append(c);
    setTimeout(() => c.remove(), 1500);
  }
}

/** Animate the swap of content (View Transitions where supported). */
export function transition(fn) {
  if (document.startViewTransition && motionOK()) document.startViewTransition(fn);
  else fn();
}
