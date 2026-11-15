// Doctor visits: upcoming/past lists with add, edit and delete.
import { $, el, svg, ICON, busy, toast, confirmDialog, formData } from '../ui.js';
import { t, fmtTime, monthShort, todayISO } from '../i18n.js';
import { api } from '../api.js';

export function createAppts(ctx) {
  const dlg = $('#apptDialog');
  const form = $('#apptForm');

  function open(a) {
    form.reset();
    form.elements.id.value = a?.id || '';
    $('#apptDialogTitle').textContent = a ? t('editAppt', { doctor: a.doctor }) : t('addAppointment');
    if (a) for (const k of ['doctor', 'specialty', 'date', 'time', 'location', 'notes']) form.elements[k].value = a[k] || '';
    else form.elements.date.min = todayISO();
    dlg.showModal();
    form.elements.doctor.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = formData(form);
    const id = body.id; delete body.id;
    busy(form.querySelector('[type=submit]'), async () => {
      await api(id ? `/api/appointments/${id}` : '/api/appointments', { method: id ? 'PUT' : 'POST', body });
      dlg.close();
      toast(id ? t('apptUpdated') : t('apptAdded'));
      await ctx.refresh();
    });
  });
  $('#addApptBtn').addEventListener('click', () => open());

  function item(a, i) {
    const d = new Date(`${a.date}T00:00:00`);
    return el('li', { class: 'appt', vars: { '--i': i } },
      el('div', { class: 'cal', 'aria-hidden': 'true' }, el('small', {}, monthShort(d)), el('strong', {}, d.getDate())),
      el('div', {},
        el('h3', {}, a.doctor),
        el('p', {}, [a.specialty, `${fmtTime(a.time)}`, a.location].filter(Boolean).join(' · ')),
        a.notes ? el('p', { class: 'small' }, a.notes) : null),
      el('div', { class: 'appt-actions' },
        el('button', { type: 'button', class: 'btn small', onclick: () => open(a), 'aria-label': t('editAppt', { doctor: a.doctor }) }, svg(ICON.edit), t('edit')),
        el('button', { type: 'button', class: 'btn small danger', onclick: () => remove(a), 'aria-label': t('deleteAppt', { doctor: a.doctor }) }, svg(ICON.trash))));
  }

  function render() {
    const today = todayISO();
    const all = ctx.state.profile.appointments;
    const up = all.filter((a) => a.date >= today);
    const past = all.filter((a) => a.date < today).reverse();
    $('#apptUpcoming').replaceChildren(...(up.length ? up.map(item) : [el('li', { class: 'empty' }, t('noUpcoming'))]));
    $('#apptPast').replaceChildren(...(past.length ? past.map(item) : [el('li', { class: 'empty' }, t('noPast'))]));
  }

  async function remove(a) {
    if (!(await confirmDialog(t('confirmDeleteAppt', { doctor: a.doctor })))) return;
    await busy(null, async () => {
      await api(`/api/appointments/${a.id}`, { method: 'DELETE' });
      toast(t('apptDeleted'));
      await ctx.refresh();
    });
  }

  return { render, open };
}
