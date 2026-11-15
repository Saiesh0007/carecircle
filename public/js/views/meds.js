// Medicines: list, add/edit dialog, AI prescription reader and AI interaction check.
import { $, el, svg, ICON, busy, toast, confirmDialog, formData } from '../ui.js';
import { t, fmtTime, todayISO } from '../i18n.js';
import { api } from '../api.js';

/** Medicines view: list, add/edit dialog, prescription reader and interaction check. */
export function createMeds(ctx) {
  const dlg = $('#medDialog');
  const form = $('#medForm');
  const timesBox = $('#timesBox');

  function timeRow(value = '') {
    const input = el('input', { type: 'time', value, required: true, 'aria-label': t('fTime') });
    const row = el(
      'div',
      { class: 'time-input' },
      input,
      el(
        'button',
        {
          type: 'button',
          'aria-label': t('removeTime'),
          onclick: () => {
            if (timesBox.children.length > 1) {
              row.remove();
            }
          },
        },
        '✕',
      ),
    );
    timesBox.append(row);
    return input;
  }

  function open(med) {
    form.reset();
    timesBox.replaceChildren();
    form.elements.id.value = med?.id || '';
    $('#medDialogTitle').textContent = med?.id ? t('editMed', { med: med.name }) : t('addMedicine');
    if (med) {
      for (const k of ['name', 'dosage', 'stock', 'startDate', 'endDate', 'instructions']) {
        form.elements[k].value = med[k] ?? '';
      }
    } else {
      form.elements.startDate.value = todayISO();
    }
    (med?.times?.length ? med.times : ['08:00']).forEach((x) => timeRow(x));
    dlg.showModal();
    form.elements.name.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const b = formData(form);
    const times = [...timesBox.querySelectorAll('input')].map((i) => i.value).filter(Boolean);
    const body = { ...b, times, stock: b.stock === '' ? null : Number(b.stock) };
    const id = body.id;
    delete body.id;
    busy(form.querySelector('[type=submit]'), async () => {
      await api(id ? `/api/medications/${id}` : '/api/medications', {
        method: id ? 'PUT' : 'POST',
        body,
      });
      dlg.close();
      toast(id ? t('medUpdated') : t('medAdded'));
      await ctx.refresh();
    });
  });
  $('#addTime').addEventListener('click', () => timeRow('').focus());
  $('#addMedBtn').addEventListener('click', () => open());

  function render() {
    const list = $('#medList');
    list.replaceChildren();
    const meds = ctx.state.profile.medications;
    if (!meds.length) {
      list.append(el('li', { class: 'empty' }, t('noMeds')));
    }
    meds.forEach((m, i) => {
      const low = m.daysLeft !== null && m.daysLeft <= 3;
      const pct = m.stock === null ? 0 : Math.min(100, Math.round((m.daysLeft / 30) * 100));
      const bar = el('span');
      list.append(
        el(
          'li',
          { class: 'med-card', vars: { '--i': i } },
          el(
            'header',
            {},
            el('div', { class: 'pill-ico' }, svg(ICON.pill)),
            el(
              'div',
              {},
              el('h3', {}, m.name),
              el(
                'p',
                {},
                [m.dosage, m.instructions].filter(Boolean).join(' · ') || t('asPrescribed'),
              ),
            ),
          ),
          el(
            'div',
            { class: 'time-chips', 'aria-label': t('fTimes') },
            m.times.map((x) => el('span', {}, fmtTime(x))),
          ),
          m.stock !== null
            ? el(
                'div',
                { class: `stock${low ? ' low' : ''}` },
                t('stockLine', { stock: m.stock, days: m.daysLeft }),
                el('div', { class: 'bar', 'aria-hidden': 'true' }, bar),
              )
            : el('p', { class: 'small' }, t('stockUntracked')),
          m.endDate ? el('p', { class: 'small' }, t('until', { date: m.endDate })) : null,
          el(
            'footer',
            {},
            el(
              'button',
              {
                type: 'button',
                class: 'btn small',
                onclick: () => open(m),
                'aria-label': t('editMed', { med: m.name }),
              },
              svg(ICON.edit),
              t('edit'),
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'btn small danger',
                onclick: () => remove(m),
                'aria-label': t('deleteMed', { med: m.name }),
              },
              svg(ICON.trash),
              t('delete'),
            ),
          ),
        ),
      );
      requestAnimationFrame(() => {
        bar.style.width = `${Math.max(3, pct)}%`;
      });
    });
  }

  async function remove(m) {
    if (!(await confirmDialog(t('confirmDeleteMed', { med: m.name })))) {
      return;
    }
    await busy(null, async () => {
      await api(`/api/medications/${m.id}`, { method: 'DELETE' });
      toast(t('medDeleted'));
      await ctx.refresh();
    });
  }

  // ---- AI: prescription reader ----
  $('#rxForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#rxText').value.trim();
    if (!text) {
      $('#rxText').focus();
      return;
    }
    busy(e.submitter || $('#rxForm [type=submit]'), async () => {
      const out = await api('/api/ai/parse', { method: 'POST', body: { text } });
      const box = $('#rxResults');
      box.replaceChildren();
      if (!out.medications.length) {
        box.append(el('p', { class: 'empty' }, t('rxNothing')));
        return;
      }
      box.append(el('p', { class: 'small muted' }, t('rxReview')));
      out.medications.forEach((m, i) => {
        const add = el('button', { type: 'button', class: 'btn small primary' }, t('add'));
        add.addEventListener('click', () =>
          busy(add, async () => {
            if (!m.times.length) {
              open({ ...m, times: ['08:00'] });
              return;
            }
            const endDate = m.durationDays ? addDaysISO(todayISO(), m.durationDays - 1) : '';
            await api('/api/medications', {
              method: 'POST',
              body: {
                name: m.name,
                dosage: m.dosage,
                times: m.times,
                instructions: m.instructions,
                startDate: todayISO(),
                endDate,
              },
            });
            add.replaceWith(el('span', { class: 'chip taken' }, `✓ ${t('added')}`));
            await ctx.refresh();
          }),
        );
        const edit = el(
          'button',
          {
            type: 'button',
            class: 'btn small',
            onclick: () => open({ ...m, times: m.times.length ? m.times : ['08:00'] }),
          },
          t('edit'),
        );
        box.append(
          el(
            'div',
            { class: 'rx-item', vars: { '--i': i } },
            el(
              'div',
              {},
              el('strong', {}, m.name),
              ` ${m.dosage || ''}`,
              el(
                'p',
                { class: 'small muted' },
                [
                  m.times.length ? m.times.map((x) => fmtTime(x)).join(', ') : t('asNeeded'),
                  m.instructions,
                  m.durationDays ? t('forDays', { n: m.durationDays }) : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
              ),
            ),
            el('div', { class: 'row' }, edit, add),
          ),
        );
      });
      if (out.notes) {
        box.append(el('p', { class: 'small muted' }, out.notes));
      }
    });
  });

  // ---- AI: interaction check ----
  $('#interactionsBtn').addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      const out = await api('/api/ai/interactions', { method: 'POST', body: {} });
      const box = $('#interactionResult');
      box.replaceChildren(
        el(
          'section',
          { class: 'card ai-card' },
          el(
            'div',
            { class: 'card-head' },
            el('h3', {}, t('interactionsTitle')),
            el('span', { class: 'tag' }, t('aiTag')),
          ),
          el('p', {}, out.summary),
          out.items.length
            ? el(
                'ul',
                { class: 'interaction-list' },
                out.items.map((x) =>
                  el(
                    'li',
                    { class: `card interaction ${x.severity}` },
                    el('strong', {}, `${t(`sev_${x.severity}`)} · ${x.medicines.join(' + ')}`),
                    el('p', {}, x.issue),
                    el('p', { class: 'small muted' }, x.advice),
                  ),
                ),
              )
            : null,
          el('p', { class: 'tiny muted' }, out.disclaimer || t('aiDisclaimer')),
        ),
      );
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }),
  );

  return { render, open };
}

/** Add `n` days to an ISO date without time-zone drift. */
function addDaysISO(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
