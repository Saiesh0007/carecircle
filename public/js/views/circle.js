// Care circle: health profile, emergency card, members & invites, reminders outbox, passcode.
import { $, el, busy, toast, confirmDialog, formData } from '../ui.js';
import { t, fmtDateTime, fmtTime } from '../i18n.js';
import { api, session } from '../api.js';

export function createCircle(ctx) {
  const pForm = $('#profileForm');

  function render() {
    const p = ctx.state.profile;
    for (const k of ['name', 'dob', 'conditions', 'allergies', 'emergencyContact', 'doctorContact']) pForm.elements[k].value = p[k] || '';
    $('#shareCode').textContent = p.id;
    const me = ctx.state.member;
    $('#members').replaceChildren(...p.members.map((m) => {
      const isMe = m.id === me.id;
      const notify = el('button', { type: 'button', class: 'btn small', 'aria-pressed': String(m.notify !== false) }, m.notify !== false ? t('emailsOn') : t('emailsOff'));
      notify.addEventListener('click', () => busy(notify, async () => {
        await api(`/api/members/${m.id}`, { method: 'PUT', body: { notify: m.notify === false } });
        await ctx.refresh();
      }));
      return el('li', { class: 'member' },
        el('div', { class: 'who' }, el('span', { class: 'avatar', 'aria-hidden': 'true' }, m.name.slice(0, 1).toUpperCase()),
          el('div', {}, el('strong', {}, `${m.name}${isMe ? ` (${t('you')})` : ''}`),
            el('small', {}, [t(`role_${m.role}`), m.email || t('noEmail'), m.verified ? `✓ ${m.verified}` : ''].filter(Boolean).join(' · ')))),
        el('div', { class: 'row' }, notify,
          isMe ? null : el('button', { type: 'button', class: 'btn small danger', 'aria-label': t('removeMember', { name: m.name }), onclick: () => removeMember(m) }, t('remove'))));
    }));
    $('#emailMode').textContent = ctx.state.config.emailMode === 'smtp' ? t('emailModeSmtp') : t('emailModeDry');
  }

  async function removeMember(m) {
    if (!(await confirmDialog(t('confirmRemoveMember', { name: m.name })))) return;
    await busy(null, async () => { await api(`/api/members/${m.id}`, { method: 'DELETE' }); toast(t('memberRemoved')); await ctx.refresh(); });
  }

  async function loadOutbox() {
    const { messages } = await api('/api/reminders/outbox');
    $('#outbox').replaceChildren(...(messages.length
      ? messages.map((m) => el('li', {}, el('strong', {}, m.subject), el('small', {}, `${t('to')} ${m.to} · ${fmtDateTime(m.at)}${m.delivered === false ? ` · ${t('preview')}` : ''}`)))
      : [el('li', { class: 'empty' }, t('outboxEmpty'))]));
  }

  pForm.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(pForm.querySelector('[type=submit]'), async () => {
      await api('/api/profile', { method: 'PUT', body: formData(pForm) });
      toast(t('profileSaved'));
      await ctx.refresh();
    });
  });

  $('#printCard').addEventListener('click', () => {
    const p = ctx.state.profile;
    const row = (k, v) => el('tr', {}, el('th', {}, t(k)), el('td', {}, v || '—'));
    $('#emergencyCard').replaceChildren(
      el('h1', {}, `${t('emergencyCard')}: ${p.name}`),
      el('table', {}, row('fDob', p.dob), row('fConditions', p.conditions), row('fAllergies', p.allergies), row('fEmergency', p.emergencyContact), row('fDoctor', p.doctorContact)),
      el('h2', {}, t('currentMeds')),
      el('table', {}, p.medications.filter((m) => m.active !== false).map((m) => el('tr', {}, el('td', {}, m.name), el('td', {}, m.dosage || ''), el('td', {}, m.times.map((x) => fmtTime(x)).join(', ')), el('td', {}, m.instructions || '')))),
      el('p', {}, `${t('careCode')}: ${p.id} · CareCircle`));
    window.print();
  });

  $('#copyCode').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ctx.state.profile.id); toast(t('copied')); } catch { toast(ctx.state.profile.id); }
  });

  $('#inviteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    busy(f.querySelector('[type=submit]'), async () => {
      await api('/api/members', { method: 'POST', body: formData(f) });
      f.reset();
      toast(t('invited'));
      await ctx.refresh();
    });
  });

  $('#passForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    busy(f.querySelector('[type=submit]'), async () => {
      const s = await api('/api/profile/passcode', { method: 'PUT', body: formData(f) });
      session.set(s.token);
      f.reset();
      toast(t('passcodeChanged'));
    });
  });

  $('#runReminders').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const { sent } = await api('/api/reminders/run', { method: 'POST' });
    toast(t('remindersSent', { n: sent }));
    await loadOutbox();
  }));

  return { render, loadOutbox };
}
