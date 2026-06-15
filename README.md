# FWC Watch Tracker

A mobile-first PWA for tracking which FIFA World Cup 2026 matches you watched.

## How to use on iPhone

1. Host this folder on GitHub Pages, Netlify, Vercel, or any static web host.
2. Open the hosted URL in Safari.
3. Tap Share → Add to Home Screen.

## Data persistence

Your watch log is stored locally in the browser using `localStorage` under `fwc26_watch_log_v1`. It persists when you close the app or restart the phone, but it can be deleted if Safari website data is cleared. Use **Export log** regularly and save the JSON to iCloud Drive, Google Drive, or Files.

## Fixtures

The app fetches fixtures from TheStatsAPI static World Cup 2026 JSON endpoint and caches them locally. If the fetch fails, it falls back to generic match placeholders so the app still loads.

## Why not Google Drive as local memory?

Google Drive is good for backup/sync, not local memory. Direct Google Drive sync would require OAuth and API setup. For a simple private tracker, local storage + export/import is cleaner.
