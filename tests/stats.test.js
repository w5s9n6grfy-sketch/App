import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/stats.js';

const day = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
const wk = (start, exercises, id = String(start)) => ({ id, name: 'W', start, end: start + 3600e3, exercises });

test('epley1RM', () => {
  assert.equal(S.epley1RM(100, 1), 100);
  assert.equal(S.epley1RM(100, 30), 200);
  assert.equal(S.epley1RM(0, 5), 0);
  assert.equal(S.epley1RM(100, 0), 0);
});

test('workoutVolume ignores sets explicitly not done', () => {
  const w = wk(0, [{ name: 'A', sets: [{ w: 100, r: 5 }, { w: 50, r: 10, done: false }, { w: 10, r: 1, done: true }] }]);
  assert.equal(S.workoutVolume(w), 510);
  assert.equal(S.workoutSetCount(w), 2);
});

test('finalizeWorkout keeps sets with reps and drops empty exercises', () => {
  const active = { id: 'x', name: '  ', start: 1, exercises: [
    { name: 'A', sets: [{ w: 60, r: 8, done: true }, { w: 60, r: null, done: false }] },
    { name: 'B', sets: [{ w: null, r: null, done: false }] },
    { name: 'Pull-up', sets: [{ w: null, r: 10, done: true }] },
  ] };
  const f = S.finalizeWorkout(active, 99);
  assert.deepEqual(f, { id: 'x', name: 'Workout', start: 1, end: 99, exercises: [
    { name: 'A', sets: [{ w: 60, r: 8 }] },
    { name: 'Pull-up', sets: [{ w: 0, r: 10 }] },
  ] });
});

test('lastPerformance and exerciseHistory', () => {
  const ws = [
    wk(day(2026, 1, 1), [{ name: 'Bench', sets: [{ w: 60, r: 10 }] }]),
    wk(day(2026, 1, 3), [{ name: 'Squat', sets: [{ w: 100, r: 5 }] }]),
    wk(day(2026, 1, 5), [{ name: 'Bench', sets: [{ w: 70, r: 5 }, { w: 65, r: 8 }] }]),
  ];
  assert.equal(S.lastPerformance(ws, 'Bench').date, day(2026, 1, 5));
  assert.equal(S.lastPerformance(ws, 'Deadlift'), null);
  const h = S.exerciseHistory(ws, 'Bench');
  assert.equal(h.length, 2);
  assert.equal(h[1].maxWeight, 70);
  assert.equal(h[1].volume, 70 * 5 + 65 * 8);
  assert.ok(Math.abs(h[1].best1RM - 65 * (1 + 8 / 30)) < 1e-9);
  assert.deepEqual(S.exerciseNames(ws), ['Bench', 'Squat']);
});

test('findNewPRs only reports improvements on known exercises', () => {
  const prev = [wk(1, [{ name: 'Bench', sets: [{ w: 60, r: 10 }] }, { name: 'Pull-up', sets: [{ w: 0, r: 8 }] }])];
  const cur = wk(2, [
    { name: 'Bench', sets: [{ w: 62.5, r: 5 }] },
    { name: 'Pull-up', sets: [{ w: 0, r: 10 }] },
    { name: 'Squat', sets: [{ w: 100, r: 5 }] },
  ]);
  assert.deepEqual(S.findNewPRs(prev, cur), [
    { name: 'Bench', kind: 'weight', value: 62.5 },
    { name: 'Pull-up', kind: 'reps', value: 10 },
  ]);
  const same1RMBetter = wk(3, [{ name: 'Bench', sets: [{ w: 60, r: 12 }] }]);
  assert.equal(S.findNewPRs(prev, same1RMBetter)[0].kind, '1rm');
});

test('weekStart is Monday local midnight', () => {
  const ws = S.weekStart(day(2026, 11, 20)); // Friday
  const d = new Date(ws);
  assert.equal(d.getDay(), 1);
  assert.equal(d.getDate(), 16);
  assert.equal(d.getHours(), 0);
  assert.equal(new Date(S.weekStart(day(2026, 11, 22))).getDate(), 16); // Sunday
  assert.equal(new Date(S.weekStart(day(2026, 11, 23))).getDate(), 23); // Monday
});

test('weekStreak tolerates an empty current week', () => {
  const now = day(2026, 11, 20);
  const ws = [wk(day(2026, 11, 3), []), wk(day(2026, 11, 11), []), wk(day(2026, 11, 12), [])];
  assert.equal(S.weekStreak(ws, now), 2);
  assert.equal(S.weekStreak([...ws, wk(day(2026, 11, 17), [])], now), 3);
  assert.equal(S.weekStreak([wk(day(2026, 10, 1), [])], now), 0);
});

test('weekSummary and weeklyCounts', () => {
  const now = day(2026, 11, 20);
  const ws = [
    wk(day(2026, 11, 16), [{ name: 'A', sets: [{ w: 10, r: 10 }] }]),
    wk(day(2026, 11, 18), [{ name: 'A', sets: [{ w: 10, r: 5 }] }]),
    wk(day(2026, 11, 10), []),
  ];
  assert.deepEqual(S.weekSummary(ws, now), { count: 2, volume: 150 });
  const c = S.weeklyCounts(ws, now, 3);
  assert.deepEqual(c.map((x) => x.count), [0, 1, 2]);
  assert.equal(c[2].label, '11/16');
});

test('bodyChange', () => {
  const e = [
    { date: '2026-09-01', kg: 82 },
    { date: '2026-10-25', kg: 80 },
    { date: '2026-11-20', kg: 79 },
  ];
  assert.equal(S.bodyChange(e, 30), -1);
  assert.equal(S.bodyChange(e.slice(-1), 30), null);
  assert.equal(S.bodyChange([{ date: '2026-01-01', kg: 80 }, { date: '2026-11-20', kg: 79 }], 30), null);
});

test('formatDuration', () => {
  assert.equal(S.formatDuration(65e3), '1:05');
  assert.equal(S.formatDuration(3725e3), '1:02:05');
  assert.equal(S.formatDurationShort(65 * 60e3), '1h 05m');
  assert.equal(S.formatDurationShort(42 * 60e3), '42 min');
});
