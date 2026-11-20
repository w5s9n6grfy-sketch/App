// Persistent app state, kept in localStorage. Weights are always stored in kg.
const KEY = 'fitlog:v1';

const defaults = () => ({
  version: 1,
  settings: { unit: 'kg', rest: 90 },
  workouts: [], // finished: { id, name, start, end, exercises: [{ name, sets: [{ w, r }] }] }
  active: null, // in progress: same shape, sets carry { w, r, done }
  body: [], // { id, date: 'YYYY-MM-DD', kg }
  custom: [], // custom exercise names
});

function normalize(d) {
  const base = defaults();
  if (!d || typeof d !== 'object') return base;
  return {
    ...base,
    ...d,
    settings: { ...base.settings, ...(d.settings || {}) },
    workouts: Array.isArray(d.workouts) ? d.workouts : [],
    body: Array.isArray(d.body) ? d.body : [],
    custom: Array.isArray(d.custom) ? d.custom : [],
    active: d.active && Array.isArray(d.active.exercises) ? d.active : null,
  };
}

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return defaults();
  }
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save', e);
  }
}

/** Replace all data (import / reset). Throws if the payload is not FitLog data. */
export function replaceState(next) {
  if (next !== null && (typeof next !== 'object' || !Array.isArray(next.workouts))) {
    throw new Error('Not a FitLog backup file');
  }
  const n = normalize(next);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, n);
  save();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
