// Pure functions over workout data — no DOM, no storage. Unit-tested in tests/.

/** Estimated one-rep max (Epley). */
export function epley1RM(w, r) {
  if (!(w > 0) || !(r > 0)) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

/** A set counts unless it is explicitly not done (active workouts track `done`). */
const counts = (s) => s.done !== false;

export function workoutVolume(workout) {
  let v = 0;
  for (const ex of workout.exercises) for (const s of ex.sets) if (counts(s)) v += (s.w || 0) * (s.r || 0);
  return v;
}

export function workoutSetCount(workout) {
  return workout.exercises.reduce((n, ex) => n + ex.sets.filter(counts).length, 0);
}

/** Turn an in-progress workout into a saved one: keep sets with reps, drop empty exercises. */
export function finalizeWorkout(active, end) {
  const exercises = active.exercises
    .map((ex) => ({
      name: ex.name,
      sets: ex.sets.filter((s) => s.r > 0).map((s) => ({ w: s.w > 0 ? s.w : 0, r: s.r })),
    }))
    .filter((ex) => ex.sets.length);
  return { id: active.id, name: (active.name || '').trim() || 'Workout', start: active.start, end, exercises };
}

function setsFor(workout, name) {
  return workout.exercises.filter((e) => e.name === name).flatMap((e) => e.sets);
}

/** Most recent finished performance of an exercise, or null. */
export function lastPerformance(workouts, name) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const sets = setsFor(workouts[i], name);
    if (sets.length) return { date: workouts[i].start, sets };
  }
  return null;
}

/** One point per session: best estimated 1RM, heaviest weight, volume. */
export function exerciseHistory(workouts, name) {
  const out = [];
  for (const w of [...workouts].sort((a, b) => a.start - b.start)) {
    const sets = setsFor(w, name);
    if (!sets.length) continue;
    out.push({
      date: w.start,
      best1RM: Math.max(...sets.map((s) => epley1RM(s.w, s.r))),
      maxWeight: Math.max(...sets.map((s) => s.w || 0)),
      volume: sets.reduce((v, s) => v + (s.w || 0) * (s.r || 0), 0),
      sets: sets.length,
    });
  }
  return out;
}

/** Exercise names in history, most frequently trained first. */
export function exerciseNames(workouts) {
  const freq = new Map();
  for (const w of workouts) for (const n of new Set(w.exercises.map((e) => e.name))) freq.set(n, (freq.get(n) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}

export function personalRecords(workouts) {
  const prs = new Map();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const p = prs.get(ex.name) || { name: ex.name, maxWeight: 0, maxWeightDate: 0, best1RM: 0, best1RMDate: 0, maxReps: 0 };
      for (const s of ex.sets) {
        if ((s.w || 0) > p.maxWeight) { p.maxWeight = s.w; p.maxWeightDate = w.start; }
        const e = epley1RM(s.w, s.r);
        if (e > p.best1RM) { p.best1RM = e; p.best1RMDate = w.start; }
        if ((s.r || 0) > p.maxReps) p.maxReps = s.r;
      }
      prs.set(ex.name, p);
    }
  }
  return prs;
}

/** PRs set by `workout` compared to all `previous` workouts (exercises done before only). */
export function findNewPRs(previous, workout) {
  const before = personalRecords(previous);
  const now = personalRecords([workout]);
  const out = [];
  for (const [name, p] of now) {
    const b = before.get(name);
    if (!b) continue;
    if (p.maxWeight > b.maxWeight && p.maxWeight > 0) out.push({ name, kind: 'weight', value: p.maxWeight });
    else if (p.best1RM > b.best1RM + 1e-9 && p.best1RM > 0) out.push({ name, kind: '1rm', value: p.best1RM });
    else if (b.maxWeight === 0 && p.maxReps > b.maxReps) out.push({ name, kind: 'reps', value: p.maxReps });
  }
  return out;
}

/** Local midnight of the Monday starting the week containing ts. */
export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function shiftWeeks(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + 7 * n);
  return d.getTime();
}

export function weekSummary(workouts, now) {
  const s = weekStart(now);
  const list = workouts.filter((w) => w.start >= s && w.start <= now);
  return { count: list.length, volume: list.reduce((v, w) => v + workoutVolume(w), 0) };
}

/** Consecutive weeks with at least one workout; the current week may still be empty. */
export function weekStreak(workouts, now) {
  const weeks = new Set(workouts.map((w) => weekStart(w.start)));
  let cur = weekStart(now);
  if (!weeks.has(cur)) cur = shiftWeeks(cur, -1);
  let n = 0;
  while (weeks.has(cur)) { n++; cur = shiftWeeks(cur, -1); }
  return n;
}

/** Workout counts for the last n weeks, oldest first. */
export function weeklyCounts(workouts, now, n) {
  const cur = weekStart(now);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = shiftWeeks(cur, -i);
    const e = shiftWeeks(s, 1);
    const d = new Date(s);
    out.push({ start: s, label: `${d.getMonth() + 1}/${d.getDate()}`, count: workouts.filter((w) => w.start >= s && w.start < e).length });
  }
  return out;
}

/** Change in body weight over the last `days` days (entries sorted by date). */
export function bodyChange(entries, days) {
  if (entries.length < 2) return null;
  const latest = entries[entries.length - 1];
  const cutoff = new Date(latest.date + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - days);
  const ref = entries.find((e) => new Date(e.date + 'T00:00:00') >= cutoff);
  return ref && ref !== latest ? latest.kg - ref.kg : null;
}

export function formatDuration(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDurationShort(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`;
}
