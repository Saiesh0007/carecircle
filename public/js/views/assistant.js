// "Saathi" AI assistant chat. Proposed actions are shown as cards and only run after the user confirms.
import { $, el, busy, toast } from '../ui.js';
import { t, fmtTime, fmtDate } from '../i18n.js';
import { api } from '../api.js';

/** Saathi chat view. AI-proposed actions run only after the user presses Confirm. */
export function createAssistant(ctx) {
  let history = [];
  const log = $('#chatLog');

  function scroll() {
    log.scrollTop = log.scrollHeight;
  }

  function greet() {
    history = [];
    log.replaceChildren(
      el(
        'li',
        { class: 'msg bot' },
        el('span', { class: 'who' }, 'Saathi'),
        t('asstHello', { name: ctx.state.member.name }),
      ),
    );
    const chips = ['chip1', 'chip2', 'chip3', 'chip4'];
    $('#chatChips').replaceChildren(
      ...chips.map((k) => el('button', { type: 'button', onclick: () => send(t(k)) }, t(k))),
    );
  }

  function describe(a) {
    if (a.type === 'mark_dose') {
      return t(a.status === 'taken' ? 'actMarkTaken' : 'actMarkSkipped', {
        med: a.medName,
        time: fmtTime(a.time),
      });
    }
    if (a.type === 'add_medication') {
      return t('actAddMed', { med: a.name, times: a.times.map((x) => fmtTime(x)).join(', ') });
    }
    if (a.type === 'add_appointment') {
      return t('actAddAppt', { doctor: a.doctor, date: fmtDate(a.date), time: fmtTime(a.time) });
    }
    return '';
  }

  async function run(a) {
    if (a.type === 'mark_dose') {
      await api('/api/doses', {
        method: 'POST',
        body: { medId: a.medId, date: a.date, time: a.time, status: a.status },
      });
    }
    if (a.type === 'add_medication') {
      await api('/api/medications', {
        method: 'POST',
        body: { name: a.name, dosage: a.dosage, times: a.times, instructions: a.instructions },
      });
    }
    if (a.type === 'add_appointment') {
      await api('/api/appointments', {
        method: 'POST',
        body: {
          doctor: a.doctor,
          specialty: a.specialty,
          date: a.date,
          time: a.time,
          location: a.location,
        },
      });
    }
    await ctx.refresh();
  }

  function actionCard(a) {
    const btn = el('button', { type: 'button', class: 'btn small primary' }, t('confirm'));
    const card = el('div', { class: 'action-card' }, el('span', {}, describe(a)), btn);
    btn.addEventListener('click', () =>
      busy(btn, async () => {
        await run(a);
        card.classList.add('done');
        btn.replaceWith(el('span', { class: 'chip taken' }, `✓ ${t('done')}`));
        toast(t('actionDone'));
      }),
    );
    return card;
  }

  async function send(text) {
    const msg = String(text || '').trim();
    if (!msg) {
      return;
    }
    $('#chatInput').value = '';
    history.push({ role: 'user', content: msg });
    log.append(el('li', { class: 'msg user' }, msg));
    const typing = el(
      'li',
      { class: 'msg bot typing', 'aria-label': t('thinking') },
      el('span'),
      el('span'),
      el('span'),
    );
    log.append(typing);
    scroll();
    const submit = $('#chatForm [type=submit]');
    submit.disabled = true;
    try {
      const out = await api('/api/ai/chat', {
        method: 'POST',
        body: { messages: history.slice(-10) },
      });
      history.push({ role: 'assistant', content: out.reply });
      typing.replaceWith(
        el(
          'li',
          { class: 'msg bot' },
          el('span', { class: 'who' }, 'Saathi'),
          out.reply,
          out.actions.map(actionCard),
        ),
      );
    } catch (e) {
      typing.remove();
      history.pop();
      toast(e.message, { error: true });
    } finally {
      submit.disabled = false;
      scroll();
    }
  }

  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    send($('#chatInput').value);
  });
  return { greet, send };
}
