const FIXTURE_URL = 'https://www.thestatsapi.com/world-cup/data/fixtures.json';
const FIXTURE_CACHE_KEY = 'fwc26_fixtures_cache_v1';
const LOG_KEY = 'fwc26_watch_log_v1';
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

const state = { fixtures: [], logs: {}, filter: 'all', stage: 'all', group: 'all', search: '', activeMatch: null, deferredPrompt: null };
const $ = (id) => document.getElementById(id);

const stageNames = {
  'group-stage': 'Group stage',
  'round-of-32': 'Round of 32',
  'round-of-16': 'Round of 16',
  'quarter-finals': 'Quarter-finals',
  'semi-finals': 'Semi-finals',
  'third-place': 'Third-place',
  'final': 'Final'
};
const statusLabels = { unwatched:'Not yet', live:'Live', replay:'Replay', highlights:'Highlights', skipped:'Skipped' };
const watchedStatuses = new Set(['live','replay','highlights']);

function fallbackFixtures() {
  const stageFor = (n) => n <= 72 ? 'group-stage' : n <= 88 ? 'round-of-32' : n <= 96 ? 'round-of-16' : n <= 100 ? 'quarter-finals' : n <= 102 ? 'semi-finals' : n === 103 ? 'third-place' : 'final';
  const start = new Date('2026-06-11T19:00:00Z');
  return Array.from({length:104}, (_, i) => {
    const matchNumber = i + 1;
    const d = new Date(start.getTime() + i * 8 * 60 * 60 * 1000);
    const stage = stageFor(matchNumber);
    const group = stage === 'group-stage' ? String.fromCharCode(65 + Math.floor(i / 6)) : null;
    return { matchNumber, date: d.toISOString().slice(0,10), kickoffUtc: d.toISOString(), stage, group, homeTeam: `Match ${matchNumber} home`, awayTeam: `Match ${matchNumber} away`, stadium: 'Venue TBC', hostCity: 'city-tbc' };
  });
}

async function loadFixtures() {
  const cached = localStorage.getItem(FIXTURE_CACHE_KEY);
  if (cached) {
    try { state.fixtures = JSON.parse(cached); } catch {}
  }
  if (!state.fixtures.length) state.fixtures = fallbackFixtures();
  render();
  try {
    const response = await fetch(FIXTURE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Fixture fetch failed');
    const data = await response.json();
    if (Array.isArray(data.fixtures) && data.fixtures.length >= 104) {
      state.fixtures = data.fixtures.sort((a,b) => a.matchNumber - b.matchNumber);
      localStorage.setItem(FIXTURE_CACHE_KEY, JSON.stringify(state.fixtures));
      render();
    }
  } catch (err) {
    console.warn('Using cached/fallback fixtures', err);
  }
}

function loadLogs() {
  try { state.logs = JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch { state.logs = {}; }
}
function saveLogs() { localStorage.setItem(LOG_KEY, JSON.stringify(state.logs)); }
function getLog(matchNumber) { return state.logs[String(matchNumber)] || { status: 'unwatched', rating: 0, where: '', with: '', notes: '', updatedAt: null }; }
function isWatched(matchNumber) { return watchedStatuses.has(getLog(matchNumber).status); }
function fmtDate(iso) { return new Intl.DateTimeFormat(undefined, { weekday:'short', month:'short', day:'numeric', timeZone: TZ }).format(new Date(iso)); }
function fmtTime(iso) { return new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit', timeZone: TZ }).format(new Date(iso)); }
function cityName(slug='') { return String(slug).replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function matchText(m) { return `${m.matchNumber} ${m.homeTeam} ${m.awayTeam} ${m.group || ''} ${m.stage} ${m.stadium} ${m.hostCity}`.toLowerCase(); }

function filteredFixtures() {
  const today = new Date().toISOString().slice(0,10);
  return state.fixtures.filter(m => {
    if (state.filter === 'watched' && !isWatched(m.matchNumber)) return false;
    if (state.filter === 'unwatched' && isWatched(m.matchNumber)) return false;
    if (state.filter === 'today' && m.date !== today) return false;
    if (state.filter === 'knockout' && m.stage === 'group-stage') return false;
    if (state.stage !== 'all' && m.stage !== state.stage) return false;
    if (state.group !== 'all' && m.group !== state.group) return false;
    if (state.search && !matchText(m).includes(state.search.toLowerCase())) return false;
    return true;
  });
}

function populateSelects() {
  const stages = [...new Set(state.fixtures.map(m => m.stage))];
  $('stageSelect').innerHTML = '<option value="all">All stages</option>' + stages.map(s => `<option value="${s}">${stageNames[s] || s}</option>`).join('');
  $('stageSelect').value = state.stage;
  const groups = [...new Set(state.fixtures.map(m => m.group).filter(Boolean))];
  $('groupSelect').innerHTML = '<option value="all">All groups</option>' + groups.map(g => `<option value="${g}">Group ${g}</option>`).join('');
  $('groupSelect').value = state.group;
}

function renderStats() {
  const total = state.fixtures.length || 104;
  const watched = state.fixtures.filter(m => isWatched(m.matchNumber)).length;
  const pct = Math.round((watched / total) * 100) || 0;
  $('watchedCount').textContent = watched;
  $('totalCount').textContent = total;
  $('progressPct').textContent = `${pct}%`;
  $('progressOrb').style.background = `conic-gradient(var(--accent) ${pct}%, rgba(255,255,255,.11) 0)`;
  const next = state.fixtures.find(m => new Date(m.kickoffUtc) > new Date() && !isWatched(m.matchNumber));
  $('nextMatch').textContent = next ? `Next unwatched: #${next.matchNumber} ${next.homeTeam} vs ${next.awayTeam}, ${fmtDate(next.kickoffUtc)} ${fmtTime(next.kickoffUtc)}` : 'No upcoming unwatched match found.';
}

function renderList() {
  const list = $('matchList');
  const matches = filteredFixtures();
  if (!matches.length) { list.innerHTML = '<div class="empty">No matches found for this filter.</div>'; return; }
  let lastDate = '';
  list.innerHTML = matches.map(m => {
    const log = getLog(m.matchNumber);
    const dateLabel = fmtDate(m.kickoffUtc);
    const header = dateLabel !== lastDate ? `<div class="date-header">${dateLabel}</div>` : '';
    lastDate = dateLabel;
    const status = log.status || 'unwatched';
    const stage = stageNames[m.stage] || m.stage;
    const group = m.group ? `Group ${m.group}` : stage;
    return `${header}<button class="match-card ${isWatched(m.matchNumber) ? 'logged' : ''}" data-match="${m.matchNumber}">
      <div class="match-line"><div class="teams">${m.homeTeam}<br><span class="muted">vs</span> ${m.awayTeam}</div><span class="badge ${status}">${statusLabels[status]}</span></div>
      <div class="meta"><span>#${m.matchNumber}</span><span>${group}</span><span>${fmtTime(m.kickoffUtc)}</span><span>${m.stadium}</span><span>${cityName(m.hostCity)}</span></div>
    </button>`;
  }).join('');
}

function render() { populateSelects(); renderStats(); renderList(); }

function openMatch(matchNumber) {
  const m = state.fixtures.find(x => Number(x.matchNumber) === Number(matchNumber));
  if (!m) return;
  state.activeMatch = m;
  const log = getLog(m.matchNumber);
  $('dialogMeta').textContent = `#${m.matchNumber} · ${stageNames[m.stage] || m.stage}${m.group ? ` · Group ${m.group}` : ''} · ${fmtDate(m.kickoffUtc)} ${fmtTime(m.kickoffUtc)}`;
  $('dialogTitle').textContent = `${m.homeTeam} vs ${m.awayTeam}`;
  $('dialogVenue').textContent = `${m.stadium} · ${cityName(m.hostCity)}`;
  document.querySelectorAll('input[name="watchStatus"]').forEach(r => r.checked = r.value === (log.status || 'unwatched'));
  $('ratingInput').value = log.rating || 0;
  $('ratingValue').textContent = `${$('ratingInput').value}/5`;
  $('whereInput').value = log.where || '';
  $('withInput').value = log.with || '';
  $('notesInput').value = log.notes || '';
  $('matchDialog').showModal();
}

function saveActiveMatch() {
  const m = state.activeMatch; if (!m) return;
  const status = document.querySelector('input[name="watchStatus"]:checked')?.value || 'unwatched';
  state.logs[String(m.matchNumber)] = { status, rating: Number($('ratingInput').value || 0), where: $('whereInput').value.trim(), with: $('withInput').value.trim(), notes: $('notesInput').value.trim(), updatedAt: new Date().toISOString() };
  saveLogs(); render();
}

function exportLog() {
  const payload = { app: 'FWC Watch Tracker', version: 1, exportedAt: new Date().toISOString(), logs: state.logs };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `fwc-watch-log-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
}

function importLog(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const logs = payload.logs || payload;
      state.logs = { ...state.logs, ...logs };
      saveLogs(); render(); alert('Log imported.');
    } catch { alert('Could not import this file.'); }
  };
  reader.readAsText(file);
}

function bindEvents() {
  $('searchInput').addEventListener('input', e => { state.search = e.target.value; renderList(); });
  $('statusFilters').addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    state.filter = btn.dataset.filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === btn)); renderList();
  });
  $('stageSelect').addEventListener('change', e => { state.stage = e.target.value; renderList(); });
  $('groupSelect').addEventListener('change', e => { state.group = e.target.value; renderList(); });
  $('matchList').addEventListener('click', e => { const card = e.target.closest('[data-match]'); if (card) openMatch(card.dataset.match); });
  $('ratingInput').addEventListener('input', e => $('ratingValue').textContent = `${e.target.value}/5`);
  $('saveBtn').addEventListener('click', saveActiveMatch);
  $('exportBtn').addEventListener('click', exportLog);
  $('importInput').addEventListener('change', e => e.target.files[0] && importLog(e.target.files[0]));
  $('resetBtn').addEventListener('click', () => { if (confirm('Reset all watch logs on this device?')) { state.logs = {}; saveLogs(); render(); } });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.deferredPrompt = e; $('installBtn').classList.remove('hidden'); });
  $('installBtn').addEventListener('click', async () => { if (state.deferredPrompt) { state.deferredPrompt.prompt(); state.deferredPrompt = null; $('installBtn').classList.add('hidden'); }});
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
loadLogs(); bindEvents(); loadFixtures();
