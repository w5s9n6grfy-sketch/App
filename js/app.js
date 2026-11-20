import { state, save, uid, replaceState } from './store.js';
import { EXERCISES, MUSCLES } from './exercises.js';
import * as S from './stats.js';
import { lineChart, barChart } from './chart.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const TITLES = { today: 'Workout', history: 'History', progress: 'Progress', body: 'Body weight', settings: 'Settings' };

let tab = 'today';
let progressExercise = null;
let elapsedTimer = null;
let picker = { q: '', m: 'All' };

// ---------- formatting & units (data is stored in kg) ----------
const LB = 2.2046226218;
const unit = () => state.settings.unit;
const toDisp = (kg) => (unit() === 'lb' ? kg * LB : kg);
const fromDisp = (v) => (unit() === 'lb' ? v / LB : v);
const r1 = (n) => Math.round(n * 10) / 10;
const fmtW = (kg) => `${r1(toDisp(kg))} ${unit()}`;
const fmtVol = (kg) => {
  const v = toDisp(kg);
  return v >= 10000 ? `${r1(v / 1000)}k ${unit()}` : `${Math.round(v).toLocaleString()} ${unit()}`;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDay = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const stat = (label, value, sub) => `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;

function defaultName() {
  const h = new Date().getHours();
  return h < 11 ? 'Morning workout' : h < 17 ? 'Afternoon workout' : 'Evening workout';
}

// ---------- rendering ----------
function render() {
  clearInterval(elapsedTimer);
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
  });
  $('#page-title').textContent = tab === 'today' && state.active ? 'Workout in progress' : TITLES[tab];
  view.innerHTML = { today: renderToday, history: renderHistory, progress: renderProgress, body: renderBody, settings: renderSettings }[tab]();
  if (tab === 'today' && state.active) {
    elapsedTimer = setInterval(() => {
      const el = $('#elapsed');
      if (el && state.active) el.textContent = S.formatDuration(Date.now() - state.active.start);
    }, 1000);
  }
}

function renderToday() {
  const a = state.active;
  if (!a) {
    const now = Date.now();
    const wk = S.weekSummary(state.workouts, now);
    const streak = S.weekStreak(state.workouts, now);
    const recent = state.workouts.slice(-3).reverse();
    return `
      <section class="card hero">
        <h2>Ready to train?</h2>
        <p class="muted">${state.workouts.length ? `Last workout: ${fmtDate(state.workouts[state.workouts.length - 1].start)}` : 'Start your first workout and build from there.'}</p>
        <button class="btn primary big" data-action="start">Start empty workout</button>
      </section>
      <section class="stats">
        ${stat('This week', wk.count, wk.count === 1 ? 'workout' : 'workouts')}
        ${stat('Volume', fmtVol(wk.volume), 'this week')}
        ${stat('Streak', streak, streak === 1 ? 'week' : 'weeks')}
      </section>
      ${recent.length
        ? `<h3 class="section-title">Repeat a recent workout</h3>${recent.map((w) => `
          <button class="card row-btn" data-action="repeat" data-id="${w.id}">
            <div><strong>${esc(w.name)}</strong>
            <div class="muted small">${fmtDate(w.start)} · ${w.exercises.map((e) => esc(e.name)).join(', ')}</div></div>
            <span class="chev" aria-hidden="true">›</span>
          </button>`).join('')}`
        : ''}`;
  }
  return `
    <section class="card active-head">
      <input class="title-input" data-field="name" value="${esc(a.name)}" aria-label="Workout name" maxlength="60">
      <div class="muted small"><span id="elapsed">${S.formatDuration(Date.now() - a.start)}</span> · <span id="live-vol">${fmtVol(S.workoutVolume(a))}</span> lifted</div>
    </section>
    ${a.exercises.length ? a.exercises.map(exerciseCard).join('') : '<p class="muted center">Add your first exercise to get going.</p>'}
    <button class="btn block" data-action="add-exercise">+ Add exercise</button>
    <div class="row gap finish-row">
      <button class="btn danger" data-action="discard">Discard</button>
      <button class="btn primary grow" data-action="finish">Finish workout</button>
    </div>`;
}

function exerciseCard(ex, i) {
  const prev = S.lastPerformance(state.workouts, ex.name);
  const rows = ex.sets.map((s, j) => {
    const p = prev?.sets[j];
    const label = `${esc(ex.name)} set ${j + 1}`;
    return `<div class="set-grid ${s.done ? 'done' : ''}">
      <span class="set-no">${j + 1}</span>
      <span class="muted small">${p ? `${r1(toDisp(p.w))} × ${p.r}` : '—'}</span>
      <input type="number" inputmode="decimal" step="any" min="0" data-ex="${i}" data-set="${j}" data-field="w"
        value="${s.w != null ? r1(toDisp(s.w)) : ''}" placeholder="${p ? r1(toDisp(p.w)) : '0'}" aria-label="${label} weight">
      <input type="number" inputmode="numeric" step="1" min="0" data-ex="${i}" data-set="${j}" data-field="r"
        value="${s.r ?? ''}" placeholder="${p ? p.r : '0'}" aria-label="${label} reps">
      <button class="check" data-action="toggle-set" data-ex="${i}" data-set="${j}" aria-pressed="${!!s.done}" aria-label="Complete ${label}">✓</button>
    </div>`;
  }).join('');
  return `<section class="card exercise" id="ex-${i}">
    <header class="ex-head"><h3>${esc(ex.name)}</h3>
      <button class="icon-btn" data-action="remove-exercise" data-ex="${i}" aria-label="Remove ${esc(ex.name)}">✕</button></header>
    <div class="set-grid head"><span>Set</span><span>Previous</span><span>${unit()}</span><span>Reps</span><span></span></div>
    ${rows}
    <div class="row gap">
      <button class="btn small ghost" data-action="add-set" data-ex="${i}">+ Add set</button>
      ${ex.sets.length > 1 ? `<button class="btn small ghost" data-action="remove-set" data-ex="${i}">− Remove set</button>` : ''}
    </div>
  </section>`;
}

function renderHistory() {
  if (!state.workouts.length) return empty('📒', 'No workouts yet', 'Finished workouts will be listed here.');
  let lastMonth = '';
  return [...state.workouts].reverse().map((w) => {
    const month = new Date(w.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const heading = month !== lastMonth ? `<h3 class="section-title">${month}</h3>` : '';
    lastMonth = month;
    const exs = w.exercises.map((e) => {
      const best = e.sets.reduce((b, s) => (S.epley1RM(s.w, s.r) > S.epley1RM(b.w, b.r) ? s : b), e.sets[0]);
      const bestTxt = best.w > 0 ? `best ${r1(toDisp(best.w))} × ${best.r}` : `best ${Math.max(...e.sets.map((s) => s.r))} reps`;
      return `<div class="hist-ex"><span>${e.sets.length} × ${esc(e.name)}</span><span>${bestTxt}</span></div>`;
    }).join('');
    return `${heading}<article class="card">
      <div class="hist-head"><div><h3>${esc(w.name)}</h3><div class="muted small">${fmtDate(w.start)}</div></div>
        <div class="row">
          <button class="btn small ghost" data-action="repeat" data-id="${w.id}">Repeat</button>
          <button class="icon-btn" data-action="delete-workout" data-id="${w.id}" aria-label="Delete ${esc(w.name)}">🗑</button>
        </div></div>
      <div class="hist-meta"><span>⏱ ${S.formatDurationShort(w.end - w.start)}</span><span>🏋 ${fmtVol(S.workoutVolume(w))}</span><span>${S.workoutSetCount(w)} sets</span></div>
      ${exs}
    </article>`;
  }).join('');
}

function renderProgress() {
  const ws = state.workouts;
  if (!ws.length) return empty('📈', 'Nothing to chart yet', 'Log a few workouts and your progress shows up here.');
  const names = S.exerciseNames(ws);
  if (!names.includes(progressExercise)) progressExercise = names[0];
  const hist = S.exerciseHistory(ws, progressExercise);
  const prs = S.personalRecords(ws);
  const p = prs.get(progressExercise);
  const weighted = p.maxWeight > 0;
  const totalVol = ws.reduce((v, w) => v + S.workoutVolume(w), 0);
  const totalTime = ws.reduce((t, w) => t + (w.end - w.start), 0);
  const points = hist.map((h) => ({ x: h.date, y: weighted ? r1(toDisp(h.best1RM)) : Math.max(...setsReps(ws, h.date, progressExercise)) }));

  const prRows = names.map((n) => prs.get(n)).filter((r) => r.maxWeight > 0).map((r) => `
    <tr><td>${esc(r.name)}</td><td>${fmtW(r.maxWeight)}</td><td>${fmtW(r.best1RM)}</td></tr>`).join('');

  return `
    <section class="stats">
      ${stat('Workouts', ws.length, 'all time')}
      ${stat('Volume', fmtVol(totalVol), 'all time')}
      ${stat('Time', S.formatDurationShort(totalTime), 'training')}
    </section>
    <section class="card"><h3>Workouts per week</h3>${barChart(S.weeklyCounts(ws, Date.now(), 12).map((w) => ({ label: w.label, y: w.count })), { label: 'Workouts per week, last 12 weeks' })}</section>
    <section class="card">
      <div class="row between gap"><h3>Exercise</h3>
        <select data-change="progress-ex" aria-label="Exercise">${names.map((n) => `<option ${n === progressExercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      </div>
      <p class="muted small">${weighted ? 'Estimated one-rep max per session (Epley formula)' : 'Most reps in a set per session'}</p>
      ${points.length >= 2 ? lineChart(points, { unit: weighted ? unit() : 'reps', label: `${progressExercise} progress` }) : '<p class="muted">Log this exercise in at least two workouts to see a trend.</p>'}
      <div class="mini-stats">
        <div><strong>${weighted ? fmtW(p.best1RM) : p.maxReps}</strong><span class="muted small">${weighted ? 'best est. 1RM' : 'most reps'}</span></div>
        <div><strong>${weighted ? fmtW(p.maxWeight) : '—'}</strong><span class="muted small">heaviest</span></div>
        <div><strong>${hist.length}</strong><span class="muted small">sessions</span></div>
      </div>
    </section>
    ${prRows ? `<section class="card"><h3>Personal records</h3>
      <table class="pr-table"><thead><tr><th>Exercise</th><th>Heaviest</th><th>Est. 1RM</th></tr></thead><tbody>${prRows}</tbody></table></section>` : ''}`;
}

function setsReps(ws, date, name) {
  const w = ws.find((x) => x.start === date);
  return w.exercises.filter((e) => e.name === name).flatMap((e) => e.sets.map((s) => s.r));
}

function renderBody() {
  const entries = [...state.body].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const change = S.bodyChange(entries, 30);
  const changeTxt = change == null ? '—' : `${change > 0 ? '+' : ''}${r1(toDisp(change))} ${unit()}`;
  return `
    <section class="card">
      <form class="form-row" data-form="body">
        <input type="number" name="weight" inputmode="decimal" step="any" min="1" required placeholder="Weight (${unit()})" aria-label="Body weight in ${unit()}">
        <input type="date" name="date" value="${todayISO()}" max="${todayISO()}" required aria-label="Date">
        <button class="btn primary">Log</button>
      </form>
    </section>
    ${entries.length ? `
    <section class="stats">
      ${stat('Current', fmtW(latest.kg), fmtDay(latest.date))}
      ${stat('30 days', changeTxt, 'change')}
      ${stat('Entries', entries.length, 'logged')}
    </section>
    ${entries.length >= 2 ? `<section class="card"><h3>Trend</h3>${lineChart(entries.map((e) => ({ x: new Date(e.date + 'T00:00:00').getTime(), y: r1(toDisp(e.kg)) })), { unit: unit(), label: 'Body weight trend' })}</section>` : ''}
    <section class="card"><h3>Log</h3>
      ${entries.slice().reverse().map((e) => `<div class="list-row"><span>${fmtDay(e.date)}</span>
        <span class="row gap"><strong>${fmtW(e.kg)}</strong><button class="icon-btn" data-action="delete-body" data-id="${e.id}" aria-label="Delete entry for ${fmtDay(e.date)}">✕</button></span></div>`).join('')}
    </section>` : empty('⚖️', 'No entries yet', 'Log your body weight to see the trend over time.')}`;
}

function renderSettings() {
  const rests = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
  return `
    <section class="card">
      <div class="setting"><span>Weight unit</span>
        <span class="segmented" role="group" aria-label="Weight unit">
          ${['kg', 'lb'].map((u) => `<button data-action="set-unit" data-unit="${u}" aria-pressed="${unit() === u}">${u}</button>`).join('')}
        </span></div>
      <div class="setting"><label for="rest-sel">Rest timer after a set</label>
        <select id="rest-sel" data-change="rest">${rests.map((s) => `<option value="${s}" ${s === state.settings.rest ? 'selected' : ''}>${s ? S.formatDuration(s * 1000) : 'Off'}</option>`).join('')}</select></div>
    </section>
    <h3 class="section-title">Your data</h3>
    <section class="card">
      <p class="muted small" style="margin-top:0">Everything is stored on this device only. Export a backup to move it to another device.</p>
      <div class="row gap wrap">
        <button class="btn" data-action="export">Export backup</button>
        <label class="btn" tabindex="0">Import backup<input type="file" accept="application/json,.json" data-change="import" class="visually-hidden"></label>
        <button class="btn danger" data-action="reset">Erase all data</button>
      </div>
    </section>
    <p class="muted small center">FitLog · ${state.workouts.length} workouts · ${state.body.length} body entries</p>`;
}

const empty = (emoji, title, text) => `<div class="empty"><span class="emoji" aria-hidden="true">${emoji}</span><h3>${title}</h3><p>${text}</p></div>`;

// ---------- modal & toast ----------
function openModal(html) {
  $('#modal').innerHTML = `<div class="backdrop" data-action="backdrop"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
}
function closeModal() {
  $('#modal').innerHTML = '';
  if (pendingAsk) { const r = pendingAsk; pendingAsk = null; r(false); }
}

// In-app confirmation dialog (native confirm() is unavailable in some embedded views).
let pendingAsk = null;
function ask(message, okLabel = 'Confirm') {
  closeModal();
  openModal(`<p class="ask-msg">${esc(message)}</p>
    <div class="row gap"><button class="btn grow" data-action="ask-no">Cancel</button>
    <button class="btn primary grow" data-action="ask-yes">${esc(okLabel)}</button></div>`);
  $('[data-action="ask-yes"]').focus();
  return new Promise((resolve) => { pendingAsk = resolve; });
}
function answer(yes) {
  const r = pendingAsk;
  pendingAsk = null;
  $('#modal').innerHTML = '';
  r?.(yes);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- exercise picker ----------
function allExercises() {
  const map = new Map(EXERCISES.map((e) => [e.name, e]));
  for (const n of state.custom) if (!map.has(n)) map.set(n, { name: n, muscle: 'Custom' });
  for (const n of S.exerciseNames(state.workouts)) if (!map.has(n)) map.set(n, { name: n, muscle: 'Custom' });
  return [...map.values()];
}

function openPicker() {
  picker = { q: '', m: 'All' };
  const groups = ['All', ...MUSCLES, ...(state.custom.length ? ['Custom'] : [])];
  openModal(`
    <header class="sheet-head"><h3>Add exercise</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></header>
    <input id="ex-search" type="search" placeholder="Search or create an exercise…" autocomplete="off" aria-label="Search exercises">
    <div class="chips">${groups.map((m) => `<button class="chip ${m === 'All' ? 'active' : ''}" data-action="muscle" data-m="${m}">${m}</button>`).join('')}</div>
    <div id="ex-list" class="ex-list"></div>`);
  const input = $('#ex-search');
  input.addEventListener('input', () => { picker.q = input.value; renderPickerList(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#ex-list .ex-item')?.click(); }
  });
  renderPickerList();
  input.focus();
}

function renderPickerList() {
  const q = picker.q.trim().toLowerCase();
  const list = allExercises()
    .filter((e) => (picker.m === 'All' || e.muscle === picker.m) && e.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exact = allExercises().some((e) => e.name.toLowerCase() === q);
  const create = q && !exact
    ? `<button class="ex-item create" data-action="pick-exercise" data-name="${esc(picker.q.trim())}" data-custom="1"><span>+ Create “${esc(picker.q.trim())}”</span></button>`
    : '';
  $('#ex-list').innerHTML = create + list.map((e) =>
    `<button class="ex-item" data-action="pick-exercise" data-name="${esc(e.name)}"><span>${esc(e.name)}</span><span class="muted small">${e.muscle}</span></button>`).join('')
    + (!list.length && !create ? '<p class="muted center">No exercises match.</p>' : '');
}

function addExercise(name) {
  const prev = S.lastPerformance(state.workouts, name);
  const sets = prev ? prev.sets.map((s) => ({ w: s.w || null, r: s.r, done: false })) : [{ w: null, r: null, done: false }];
  state.active.exercises.push({ name, sets });
  save();
}

// ---------- rest timer ----------
const rest = { end: 0, total: 0, int: null };
function startRest(sec = state.settings.rest) {
  if (!sec) return;
  rest.total = sec;
  rest.end = Date.now() + sec * 1000;
  $('#rest').hidden = false;
  document.body.classList.add('resting');
  clearInterval(rest.int);
  rest.int = setInterval(tickRest, 250);
  tickRest();
}
function stopRest() {
  clearInterval(rest.int);
  $('#rest').hidden = true;
  document.body.classList.remove('resting');
}
function tickRest() {
  const left = Math.max(0, rest.end - Date.now());
  $('#rest-time').textContent = S.formatDuration(Math.ceil(left / 1000) * 1000);
  $('#rest-bar').style.width = `${(left / (rest.total * 1000)) * 100}%`;
  if (left <= 0) {
    stopRest();
    beep();
    navigator.vibrate?.([200, 100, 200]);
    toast('Rest over — next set!');
  }
}
let audioCtx;
function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((t) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t);
      o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch { /* audio unavailable */ }
}

// ---------- actions ----------
function newWorkout(name, exercises = []) {
  return { id: uid(), name, start: Date.now(), exercises };
}

const actions = {
  start() {
    state.active = newWorkout(defaultName());
    save();
    render();
    openPicker();
  },
  async repeat(b) {
    if (state.active && !await ask('You already have a workout in progress. Replace it?', 'Replace')) return;
    const src = state.workouts.find((w) => w.id === b.dataset.id);
    if (!src) return;
    state.active = newWorkout(src.name, src.exercises.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ w: s.w || null, r: s.r, done: false })) })));
    save();
    tab = 'today';
    render();
    window.scrollTo(0, 0);
  },
  'add-exercise': openPicker,
  'pick-exercise'(b) {
    const name = b.dataset.name;
    if (b.dataset.custom && !state.custom.includes(name)) state.custom.push(name);
    addExercise(name);
    closeModal();
    render();
    $(`#ex-${state.active.exercises.length - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  muscle(b) {
    picker.m = b.dataset.m;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b));
    renderPickerList();
  },
  async 'remove-exercise'(b) {
    const ex = state.active.exercises[b.dataset.ex];
    if (ex.sets.some((s) => s.done) && !await ask(`Remove ${ex.name} and its completed sets?`, 'Remove')) return;
    state.active.exercises.splice(b.dataset.ex, 1);
    save();
    render();
  },
  'add-set'(b) {
    const sets = state.active.exercises[b.dataset.ex].sets;
    const last = sets[sets.length - 1];
    sets.push({ w: last?.w ?? null, r: last?.r ?? null, done: false });
    save();
    render();
  },
  'remove-set'(b) {
    state.active.exercises[b.dataset.ex].sets.pop();
    save();
    render();
  },
  'toggle-set'(b) {
    const ex = state.active.exercises[b.dataset.ex];
    const set = ex.sets[b.dataset.set];
    if (!set.done) {
      // Fill blanks from the placeholder (last time's numbers) so a single tap logs the set.
      const p = S.lastPerformance(state.workouts, ex.name)?.sets[b.dataset.set];
      if (set.r == null && p) set.r = p.r;
      if (set.w == null && p) set.w = p.w || null;
      if (!(set.r > 0)) { toast('Enter reps first'); return; }
    }
    set.done = !set.done;
    save();
    render();
    if (set.done) startRest();
  },
  async finish() {
    const a = state.active;
    const done = S.finalizeWorkout(a, Date.now());
    if (!done.exercises.length) {
      if (await ask('No sets with reps were logged. Discard this workout?', 'Discard')) actions['discard-now']();
      return;
    }
    const undone = a.exercises.some((e) => e.sets.some((s) => !s.done && s.r > 0));
    if (undone && !await ask('Some sets are not ticked off. They will be saved too — finish anyway?', 'Finish')) return;
    const prs = S.findNewPRs(state.workouts, done);
    state.workouts.push(done);
    state.workouts.sort((x, y) => x.start - y.start);
    state.active = null;
    save();
    stopRest();
    render();
    showSummary(done, prs);
  },
  async discard() {
    if (await ask('Discard this workout? This cannot be undone.', 'Discard')) actions['discard-now']();
  },
  'discard-now'() {
    state.active = null;
    save();
    stopRest();
    render();
  },
  async 'delete-workout'(b) {
    const w = state.workouts.find((x) => x.id === b.dataset.id);
    if (!w || !await ask(`Delete “${w.name}” from ${fmtDate(w.start)}?`, 'Delete')) return;
    state.workouts = state.workouts.filter((x) => x !== w);
    save();
    render();
  },
  'delete-body'(b) {
    state.body = state.body.filter((e) => e.id !== b.dataset.id);
    save();
    render();
  },
  'set-unit'(b) {
    state.settings.unit = b.dataset.unit;
    save();
    render();
  },
  export() {
    const json = JSON.stringify(state, null, 2);
    openModal(`
      <header class="sheet-head"><h3>Backup</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></header>
      <p class="muted small">Copy this text and keep it somewhere safe, or download it as a file. Use Import backup to restore it.</p>
      <textarea id="backup-text" class="backup-text" readonly>${esc(json)}</textarea>
      <div class="row gap"><button class="btn grow" data-action="download-backup">Download file</button>
      <button class="btn primary grow" data-action="copy-backup">Copy</button></div>`);
  },
  'copy-backup'() {
    const t = $('#backup-text');
    navigator.clipboard?.writeText(t.value).then(() => toast('Backup copied'), () => { t.select(); toast('Press Ctrl/Cmd+C to copy'); })
      ?? (t.select(), toast('Press Ctrl/Cmd+C to copy'));
  },
  'download-backup'() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fitlog-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'ask-yes'() { answer(true); },
  'ask-no'() { answer(false); },
  async reset() {
    if (!await ask('Erase ALL workouts, body weight entries and settings?', 'Erase')) return;
    if (!await ask('Really erase everything? Export a backup first if unsure.', 'Erase everything')) return;
    replaceState(null);
    stopRest();
    render();
    toast('All data erased');
  },
  'rest-add'(b) {
    rest.end += Number(b.dataset.sec) * 1000;
    rest.total = Math.max(rest.total, (rest.end - Date.now()) / 1000);
    tickRest();
  },
  'rest-skip': stopRest,
  'close-modal': closeModal,
  backdrop(b, e) { if (e.target === b) closeModal(); },
};

function showSummary(w, prs) {
  const labels = { weight: (v) => `Heaviest: ${fmtW(v)}`, '1rm': (v) => `Est. 1RM: ${fmtW(v)}`, reps: (v) => `Most reps: ${v}` };
  openModal(`
    <header class="sheet-head"><h3>Workout complete 💪</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></header>
    <div class="summary-big">
      <div><strong>${S.formatDurationShort(w.end - w.start)}</strong><span class="muted small">duration</span></div>
      <div><strong>${fmtVol(S.workoutVolume(w))}</strong><span class="muted small">volume</span></div>
      <div><strong>${S.workoutSetCount(w)}</strong><span class="muted small">sets</span></div>
    </div>
    ${prs.length ? `<div><h3 class="section-title">New personal records 🏆</h3><ul class="pr-list">${prs.map((p) => `<li><span>${esc(p.name)}</span><strong>${labels[p.kind](p.value)}</strong></li>`).join('')}</ul></div>` : ''}
    <button class="btn primary big" data-action="close-modal">Done</button>`);
}

const changes = {
  'progress-ex'(t) { progressExercise = t.value; render(); },
  rest(t) { state.settings.rest = Number(t.value); save(); toast('Rest timer updated'); },
  async import(t) {
    const file = t.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!await ask('Replace all current data with this backup?', 'Replace')) return;
      replaceState(data);
      render();
      toast(`Imported ${state.workouts.length} workouts`);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    } finally {
      t.value = '';
    }
  },
};

// ---------- event wiring ----------
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) {
    tab = tabBtn.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const b = e.target.closest('[data-action]');
  if (b && actions[b.dataset.action]) actions[b.dataset.action](b, e);
});

view.addEventListener('input', (e) => {
  const t = e.target;
  if (tab !== 'today' || !state.active || !t.dataset.field) return;
  if (t.dataset.field === 'name') { state.active.name = t.value; save(); return; }
  const set = state.active.exercises[t.dataset.ex]?.sets[t.dataset.set];
  if (!set) return;
  const v = t.value === '' ? null : Number(t.value);
  const ok = v != null && Number.isFinite(v) && v >= 0;
  if (t.dataset.field === 'w') set.w = ok ? fromDisp(v) : null;
  if (t.dataset.field === 'r') set.r = ok ? Math.round(v) : null;
  save();
  const vol = $('#live-vol');
  if (vol) vol.textContent = fmtVol(S.workoutVolume(state.active));
});

view.addEventListener('change', (e) => {
  const k = e.target.dataset.change;
  if (k && changes[k]) changes[k](e.target);
});

view.addEventListener('submit', (e) => {
  if (e.target.dataset.form !== 'body') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const v = Number(f.get('weight'));
  const date = String(f.get('date'));
  if (!(v > 0) || !date) return;
  state.body = state.body.filter((x) => x.date !== date);
  state.body.push({ id: uid(), date, kg: fromDisp(v) });
  save();
  render();
  toast('Body weight logged');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#modal').innerHTML) closeModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('label.btn')) { e.preventDefault(); e.target.querySelector('input')?.click(); }
});

// Timers are throttled in background tabs; refresh the rest timer as soon as the page is visible again.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#rest').hidden) tickRest(); });

render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
