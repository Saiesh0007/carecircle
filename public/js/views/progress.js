// Progress: adherence stats, daily bars, dose heatmap, per-medicine rates, AI summary and activity feed.
import { $, $$, el, busy, toast } from '../ui.js';
import { t, fmtTime, fmtDate, fmtDateTime } from '../i18n.js';
import { api } from '../api.js';

/** Progress view: adherence stats, daily bars, dose heat-map, AI summary and activity feed. */
export function createProgress() {
  let days = 7;
  let lastSummary = null;

  async function load() {
    const [ad, hist, act] = await Promise.all([
      api(`/api/adherence?days=${days}`),
      api(`/api/history?days=${Math.min(days, 21)}`),
      api('/api/activity'),
    ]);
    renderStats(ad);
    renderBars(ad);
    renderHeat(hist);
    renderPerMed(ad);
    renderActivity(act);
  }

  function renderStats(ad) {
    const missed = ad.total - ad.taken;
    $('#progStats').replaceChildren(
      el(
        'article',
        { class: 'stat-card' },
        el(
          'div',
          {},
          el('h3', {}, t('statAdherence')),
          el('p', { class: 'stat-big' }, ad.rate === null ? '–' : `${ad.rate}%`),
        ),
      ),
      el(
        'article',
        { class: 'stat-card' },
        el(
          'div',
          {},
          el('h3', {}, t('dosesTaken')),
          el('p', { class: 'stat-big' }, `${ad.taken}/${ad.total}`),
        ),
      ),
      el(
        'article',
        { class: 'stat-card' },
        el(
          'div',
          {},
          el('h3', {}, t('dosesMissed')),
          el('p', { class: 'stat-big' }, String(missed)),
        ),
      ),
    );
  }

  function renderBars(ad) {
    const bars = $('#bars');
    bars.setAttribute(
      'aria-label',
      t('barsAria', {
        list: ad.daily
          .map((d) => `${fmtDate(d.date)}: ${d.rate === null ? t('noData') : `${d.rate}%`}`)
          .join(', '),
      }),
    );
    bars.replaceChildren(
      ...ad.daily.map((d, i) => {
        const fill = el('span', {
          class: `fill ${d.rate === null ? 'none' : d.rate >= 80 ? '' : d.rate >= 50 ? 'mid' : 'lowv'}`,
          vars: { '--i': i },
        });
        fill.style.height = `${d.rate === null ? 2 : Math.max(3, d.rate)}%`;
        return el(
          'div',
          { class: 'bar', 'aria-hidden': 'true' },
          days <= 14 ? el('b', {}, d.rate === null ? '' : `${d.rate}`) : null,
          fill,
          el('small', {}, days <= 14 || i % 3 === 0 ? d.date.slice(8) : ''),
        );
      }),
    );
  }

  function renderHeat(hist) {
    const slots = [
      ...new Set(hist.flatMap((d) => d.items.map((x) => `${x.time}|${x.name}`))),
    ].sort();
    const heat = $('#heat');
    heat.style.setProperty('--cols', hist.length);
    let n = 0;
    const header = el(
      'div',
      { class: 'hrow', 'aria-hidden': 'true' },
      el('span'),
      hist.map((d) => el('span', { class: 'hlabel' }, d.date.slice(8))),
    );
    const rows = slots.map((slot) => {
      const [time, name] = slot.split('|');
      return el(
        'div',
        { class: 'hrow' },
        el('span', { class: 'hlabel', title: name }, `${fmtTime(time, true)}`),
        hist.map((d) => {
          const it = d.items.find((x) => x.time === time && x.name === name);
          const status = it ? it.status : 'none';
          n += 1;
          return el('span', {
            class: `cell ${status}`,
            vars: { '--i': n },
            role: 'img',
            'aria-label': `${name} ${fmtDate(d.date)} ${fmtTime(time)}: ${it ? t(`status_${status}`) : t('noDose')}`,
            title: `${name} · ${fmtDate(d.date)} · ${it ? t(`status_${status}`) : '—'}`,
          });
        }),
      );
    });
    heat.replaceChildren(
      header,
      ...(rows.length ? rows : [el('p', { class: 'empty' }, t('noData'))]),
    );
  }

  function renderPerMed(ad) {
    const ul = $('#perMed');
    ul.replaceChildren(
      ...(ad.perMed.length
        ? ad.perMed.map((m) => {
            const fill = el('span');
            requestAnimationFrame(() => {
              fill.style.width = `${m.rate ?? 0}%`;
            });
            return el(
              'li',
              {},
              el(
                'div',
                { class: 'row' },
                el('strong', {}, m.name),
                el('span', { class: 'muted' }, m.rate === null ? t('noData') : `${m.rate}%`),
              ),
              el(
                'div',
                {
                  class: 'meter',
                  role: 'progressbar',
                  'aria-valuemin': '0',
                  'aria-valuemax': '100',
                  'aria-valuenow': String(m.rate ?? 0),
                  'aria-label': m.name,
                },
                fill,
              ),
            );
          })
        : [el('li', { class: 'empty' }, t('noData'))]),
    );
  }

  function renderActivity(items) {
    $('#activity').replaceChildren(
      ...(items.length
        ? items
            .slice(0, 25)
            .map((a) =>
              el(
                'li',
                {},
                el('span', { class: 'dot', 'aria-hidden': 'true' }),
                el(
                  'div',
                  {},
                  el('span', {}, `${a.by}: ${activityText(a)}`),
                  el('time', { datetime: a.at }, fmtDateTime(a.at)),
                ),
              ),
            )
        : [el('li', { class: 'empty' }, t('noActivity'))]),
    );
  }

  function activityText(a) {
    if (!a.key) {
      return a.text || '';
    }
    const p = { ...a.params };
    if (p.status) {
      p.status = t(`status_${p.status === 'undo' ? 'cleared' : p.status}`);
    }
    if (p.time && /^\d\d:\d\d$/.test(p.time)) {
      p.time = fmtTime(p.time);
    }
    if (p.date) {
      p.date = fmtDate(p.date);
    }
    return t(a.key, p);
  }

  function renderSummary(s) {
    const list = (label, arr) =>
      arr.length
        ? [
            el('span', { class: 'lbl' }, label),
            el(
              'ul',
              {},
              arr.map((x) => el('li', {}, x)),
            ),
          ]
        : [];
    $('#summaryOut').replaceChildren(
      el(
        'div',
        { class: 'summary' },
        el('h4', {}, s.headline),
        el('p', {}, s.summary),
        list(t('wins'), s.wins),
        list(t('concerns'), s.concerns),
        list(t('suggestions'), s.suggestions),
      ),
    );
    $('#summaryShare').hidden = false;
  }

  $('#summaryBtn').addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      lastSummary = await api('/api/ai/summary', { method: 'POST', body: {} });
      renderSummary(lastSummary);
    }),
  );
  $('#summaryShare').addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      const out = await api('/api/ai/summary', { method: 'POST', body: { share: true } });
      renderSummary(out);
      toast(t('summarySent', { n: out.emailed }));
    }),
  );
  for (const b of $$('[data-days]')) {
    b.addEventListener('click', () => {
      days = Number(b.dataset.days);
      for (const x of $$('[data-days]')) {
        x.setAttribute('aria-pressed', String(x === b));
      }
      load().catch((e) => toast(e.message, { error: true }));
    });
  }

  return { load, activityText };
}
