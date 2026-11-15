// "Today" dashboard: stats, dose timeline, ML risk forecast and insights.
import { $, el, svg, ICON, busy, toast, confetti, enableTilt } from '../ui.js';
import { t, fmtTime, fmtDate, fmtLongDate, greetingKey, getLang, speechLang } from '../i18n.js';
import { api } from '../api.js';

const RING = 201; // circumference for r=32

export function setRing(ringEl, pct) {
  const fg = ringEl.querySelector('.ring-fg');
  requestAnimationFrame(() => { fg.style.strokeDashoffset = String(RING - (RING * (pct || 0)) / 100); });
}

export function createToday(ctx) {
  let data = null;

  async function load() {
    data = await api('/api/dashboard');
    render();
  }

  function render() {
    if (!data) return;
    const { schedule, insights, risk, adherence, nextAppointment, now } = data;
    $('#todayDate').textContent = fmtLongDate(now.date);
    $('#todayTitle').textContent = t(greetingKey(now.minutes), { name: ctx.state.member.name });

    // Stats
    $('#adhPct').textContent = adherence.rate === null ? '–' : `${adherence.rate}%`;
    setRing($('#adhRing'), adherence.rate);
    const next = schedule.find((s) => s.status === 'pending' || s.status === 'due');
    $('#nextDose').textContent = next ? fmtTime(next.time) : t('allDone');
    $('#nextDoseSub').textContent = next ? `${next.name}${next.dosage ? ` · ${next.dosage}` : ''}` : t('noMoreDoses');
    $('#streak').textContent = t('daysCount', { n: adherence.streak });
    $('#nextVisit').textContent = nextAppointment ? `${fmtDate(nextAppointment.date)} · ${fmtTime(nextAppointment.time)}` : t('none');
    $('#nextVisitSub').textContent = nextAppointment ? nextAppointment.doctor : '';

    // Timeline
    const done = schedule.filter((s) => s.status === 'taken' || s.status === 'skipped').length;
    $('#doseCount').textContent = schedule.length ? t('doneOf', { done, total: schedule.length }) : '';
    const list = $('#timeline');
    list.replaceChildren();
    if (!schedule.length) list.append(el('li', { class: 'empty' }, t('noDosesToday')));
    schedule.forEach((s, i) => list.append(doseItem(s, i)));

    // Risk forecast
    const rl = $('#riskList');
    rl.replaceChildren();
    if (!risk.length) rl.append(el('li', { class: 'empty' }, t('riskNone')));
    risk.slice(0, 5).forEach((r, i) => {
      const fill = el('span');
      const reasons = r.reasons.map((x) => t(x.key, x.params)).join(' · ');
      rl.append(el('li', { class: 'risk-item', 'data-level': r.level, vars: { '--i': i } },
        el('span', {}, el('strong', {}, r.name), ` · ${fmtTime(r.time)}`),
        el('b', { 'aria-label': t('riskAria', { pct: r.risk, level: t(`level_${r.level}`) }) }, `${r.risk}% · ${t(`level_${r.level}`)}`),
        el('div', { class: 'meter', 'aria-hidden': 'true' }, fill),
        reasons ? el('small', {}, reasons) : null));
      requestAnimationFrame(() => { fill.style.width = `${Math.max(4, r.risk)}%`; });
    });

    // Insights
    const ins = $('#insights');
    ins.replaceChildren();
    if (!insights.length) ins.append(el('li', { class: 'empty' }, t('insNone')));
    insights.forEach((x, i) => ins.append(el('li', { class: `insight ${x.level}`, vars: { '--i': i } },
      el('span', {}, t(x.key, { ...x.params, date: x.params.date ? fmtDate(x.params.date) : undefined, time: x.params.time ? fmtTime(x.params.time) : undefined })))));
    enableTilt($('#view-today'));
  }

  function doseItem(s, i) {
    const final = s.status === 'taken' || s.status === 'skipped';
    const btn = (cls, icon, label, aria, onclick) => el('button', { type: 'button', class: `btn small ${cls}`, 'aria-label': aria, onclick }, svg(icon), label);
    const aria = (k) => t(k, { med: s.name, time: fmtTime(s.time) });
    return el('li', { class: 'dose', 'data-status': s.status, vars: { '--i': i } },
      el('div', { class: 'dose-time' }, fmtTime(s.time, true)),
      el('div', { class: 'dose-body' },
        el('div', { class: 'dose-info' },
          el('strong', {}, s.name), ' ', el('span', { class: `chip ${s.status}` }, t(`status_${s.status}`)),
          el('p', {}, [s.dosage, s.instructions].filter(Boolean).join(' · ')),
          s.recordedBy ? el('p', {}, t('recordedBy', { name: s.recordedBy })) : null),
        el('div', { class: 'dose-actions' },
          final
            ? btn('ghost', ICON.undo, t('undo'), aria('undoAria'), (e) => mark(s, 'undo', e.currentTarget))
            : [
              btn('primary', ICON.check, t('taken'), aria('takenAria'), (e) => mark(s, 'taken', e.currentTarget)),
              btn('', ICON.skip, t('skip'), aria('skipAria'), (e) => mark(s, 'skipped', e.currentTarget)),
            ])));
  }

  async function mark(s, status, button) {
    await busy(button, async () => {
      await api('/api/doses', { method: 'POST', body: { medId: s.medId, date: s.date, time: s.time, status } });
      await load();
      ctx.onDataChanged?.();
      if (status === 'taken') {
        const remaining = data.schedule.filter((x) => x.status === 'pending' || x.status === 'due' || x.status === 'missed').length;
        if (remaining === 0) { confetti($('#timeline')); toast(t('allDoneToast')); } else toast(t('markedTaken', { med: s.name }));
      } else toast(status === 'undo' ? t('cleared') : t('markedSkipped', { med: s.name }));
    });
  }

  function readAloud() {
    if (!('speechSynthesis' in window) || !data) { toast(t('noSpeech'), { error: true }); return; }
    const left = data.schedule.filter((s) => s.status === 'pending' || s.status === 'due');
    const name = ctx.state.profile.name;
    const text = left.length
      ? t('speakLeft', { name, list: left.map((s) => t('speakItem', { med: s.name, dosage: s.dosage || '', time: fmtTime(s.time) })).join('. ') })
      : t('speakDone', { name });
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang();
    u.rate = 0.92;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(getLang() === 'hi' ? 'hi' : 'en-in'))
      || speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(getLang()));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  $('#readAloud').addEventListener('click', readAloud);
  return { load, render, get data() { return data; } };
}
