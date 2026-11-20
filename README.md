# FitLog

An offline-first workout tracker that runs in the browser and can be installed on your phone's home screen (PWA). It has no dependencies and no build step, and your data never leaves the device.

## Features

- **Log workouts**: add exercises from a built-in library of 44 (filter by muscle group) or create your own. Log weight × reps per set and tick each set off.
- **Smart prefill**: each exercise shows what you did last time, and new sets start from those numbers, so ticking a set can be one tap.
- **Rest timer**: starts automatically when you complete a set. ±15s / skip, with a beep and vibration when it ends.
- **Workout summary**: duration, volume, sets, and any new personal records 🏆.
- **History**: grouped by month, with the best set per exercise. Repeat or delete any workout.
- **Progress**: workouts per week (last 12 weeks), estimated one-rep max trend per exercise (Epley), and a personal-records table.
- **Body weight**: log entries, see a trend chart and the 30-day change.
- **Settings**: kg / lb, rest-timer length, export/import a JSON backup, erase all data.
- Light and dark themes, mobile-first layout, works offline via a service worker.

## Run it

```sh
npm start          # serves on http://localhost:8080 (needs python3)
```

Any static file server works. ES modules and the service worker need `http://`, not `file://`.

## Install on your phone

The app is hosted with GitHub Pages at **https://w5s9n6grfy-sketch.github.io/App/**
(Settings → Pages → Deploy from a branch → `claude/fitness-app-im9vtq`, folder `/ (root)`).

- **iPhone (Safari):** open the link → Share button → **Add to Home Screen**.
- **Android (Chrome):** open the link → ⋮ menu → **Install app** (or **Add to Home screen**).

Once installed it opens full-screen like a normal app and works offline. Data is stored on the device;
use Settings → Export backup to keep a copy.

## Test

```sh
npm test           # unit tests for the stats/PR/streak logic (Node 18+)
```

## Structure

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | App shell and styles |
| `js/app.js` | Views, event handling, rest timer |
| `js/store.js` | State persisted to `localStorage` (weights stored in kg) |
| `js/stats.js` | Pure calculations: volume, 1RM, PRs, streaks, weekly counts |
| `js/chart.js` | Small SVG line and bar charts |
| `js/exercises.js` | Built-in exercise library |
| `sw.js`, `manifest.webmanifest` | Offline support and installability |
