const ALARM_NAME    = 'bas-next-search';
const STATE_KEY     = 'searchState';
const SETTINGS_KEY  = 'basSettings';

const DEFAULT_SETTINGS = {
  delayMinSec: 36,
  delayMaxSec: 108,
  delayFixed: false,
  coffeeBreakEnabled: true,
  coffeeBreakEvery: 5,
  coffeeBreakMinSec: 180,
  coffeeBreakMaxSec: 360,
  coffeeBreakFixed: false,
  includeDelayInReading: false,
  scrollEnabled: true
};

// ─── Utilities ───────────────────────────────────────────────

const sleep  = ms => new Promise(r => setTimeout(r, ms));
const rand   = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const randF  = (lo, hi) => Math.random() * (hi - lo) + lo;

let _nextTimer = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function isStopped() {
  const s = await getState();
  return !s || !s.isRunning;
}

// ─── Settings ────────────────────────────────────────────────

async function loadSettings() {
  const d = await chrome.storage.local.get(SETTINGS_KEY);
  return Object.assign({}, DEFAULT_SETTINGS, d[SETTINGS_KEY]);
}

// ─── Persistent State ────────────────────────────────────────

async function getState() {
  const d = await chrome.storage.local.get(STATE_KEY);
  return d[STATE_KEY] || null;
}
async function setState(s) {
  await chrome.storage.local.set({ [STATE_KEY]: s });
}
async function clearState() {
  await chrome.storage.local.remove(STATE_KEY);
  await chrome.alarms.clear(ALARM_NAME);
  if (_nextTimer) { clearTimeout(_nextTimer); _nextTimer = null; }
  chrome.action.setBadgeText({ text: '' });
}

// ─── Badge ───────────────────────────────────────────────────

function badge(cur, total, color = '#06b6d4') {
  chrome.action.setBadgeText({ text: `${cur}` });
  chrome.action.setBadgeBackgroundColor({ color });
}

// ─── Google Trends ───────────────────────────────────────────

function detectCountryCode() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || 'en-US';
    const tzToGeo = {
      'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Mumbai': 'IN',
      'Europe/London': 'GB', 'Europe/Dublin': 'GB',
      'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
      'America/Los_Angeles': 'US', 'America/Phoenix': 'US',
      'America/Toronto': 'CA', 'America/Vancouver': 'CA',
      'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU',
      'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Rome': 'IT',
      'Europe/Madrid': 'ES', 'Asia/Tokyo': 'JP', 'Asia/Singapore': 'SG',
      'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Shanghai': 'CN',
      'Asia/Seoul': 'KR', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
      'Africa/Johannesburg': 'ZA', 'Pacific/Auckland': 'NZ',
      'Europe/Amsterdam': 'NL', 'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE',
      'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Bangkok': 'TH',
      'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK'
    };
    if (tzToGeo[tz]) return tzToGeo[tz];
    const region = locale.split('-')[1] || locale.split('_')[1];
    if (region && region.length === 2) return region.toUpperCase();
  } catch { /* fallback below */ }
  return 'US';
}

async function fetchTrends() {
  const geo = detectCountryCode();
  const url = `https://trends.google.com/trending/rss?geo=${geo}`;

  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const txt = await r.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(txt, 'text/xml');
    const items = xml.querySelectorAll('item > title');
    const queries = [...items]
      .map(el => el.textContent.trim())
      .filter(t => t.length > 0 && t.length < 80);
    if (queries.length) return [...new Set(queries)];
  } catch { /* silent fail, use fallback */ }
  return [];
}

async function loadFallback() {
  try {
    const r = await fetch(chrome.runtime.getURL('assets/queries.json'));
    return await r.json();
  } catch {
    return ['weather today', 'latest news', 'best recipes', 'how to'];
  }
}

async function buildQueries(count) {
  const [trends, fallback] = await Promise.all([fetchTrends(), loadFallback()]);
  const hasTrends = trends.length > 0;
  const pool = hasTrends
    ? [...shuffle(trends), ...shuffle(fallback)]
    : shuffle(fallback);

  const used = new Set();
  const result = [];
  for (let i = 0; result.length < count; i++) {
    const q = pool[i % pool.length];
    if (!used.has(q) || i >= pool.length) { result.push(q); used.add(q); }
  }
  return { queries: shuffle(result), hasTrends, trendCount: trends.length };
}

// ─── Tab helpers ─────────────────────────────────────────────

async function ensureTab(tabId) {
  try { return await chrome.tabs.get(tabId); }
  catch {
    const t = await chrome.tabs.create({ url: 'https://www.bing.com/', active: false });
    const s = await getState();
    if (s) { s.tabId = t.id; await setState(s); }
    return t;
  }
}

function navigateAndWait(tabId, url, timeout = 20000) {
  return new Promise(resolve => {
    let sawLoading = false;
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); resolve(); }, timeout);
    function fn(id, info) {
      if (id !== tabId) return;
      if (info.status === 'loading') sawLoading = true;
      if (info.status === 'complete' && sawLoading) {
        clearTimeout(timer); chrome.tabs.onUpdated.removeListener(fn); resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(fn);
    chrome.tabs.update(tabId, { url });
  });
}

function waitForComplete(tabId, timeout = 20000) {
  return new Promise(resolve => {
    let sawLoading = false;
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); resolve(); }, timeout);
    function fn(id, info) {
      if (id !== tabId) return;
      if (info.status === 'loading') sawLoading = true;
      if (info.status === 'complete' && sawLoading) {
        clearTimeout(timer); chrome.tabs.onUpdated.removeListener(fn); resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(fn);
  });
}

async function sendToTab(tabId, msg, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try { return await chrome.tabs.sendMessage(tabId, msg); }
    catch { if (i < retries - 1) await sleep(700); }
  }
  throw new Error('Content script unreachable');
}

// ─── Search execution ────────────────────────────────────────

async function executeSearch() {
  const state = await getState();
  if (!state || !state.isRunning) return;
  if (state.currentIndex >= state.totalSearches) { await finishSession(); return; }

  const query = state.queries[state.currentIndex];
  const num   = state.currentIndex + 1;
  const cfg   = state.settings || DEFAULT_SETTINGS;

  state.status    = 'searching';
  state.lastQuery = query;
  await setState(state);
  badge(num, state.totalSearches);

  let readingDurationSec = 0;

  try {
    const tab = await ensureTab(state.tabId);
    const tabId = tab.id;
    const onBing = (tab.url || '').includes('bing.com');

    // 1 — only navigate to Bing if we're not already there
    if (!onBing) {
      await navigateAndWait(tabId, 'https://www.bing.com/');
      if (await isStopped()) return;
      await sleep(rand(900, 2200));
    } else {
      await sleep(rand(400, 1000));
    }

    // 2 — type query into the existing search bar
    if (await isStopped()) return;
    await sendToTab(tabId, { action: 'type', query });
    if (await isStopped()) return;
    await sleep(rand(250, 600));

    // 3 — submit
    if (await isStopped()) return;
    chrome.tabs.sendMessage(tabId, { action: 'submit' }).catch(() => {});

    // 4 — wait for results
    await waitForComplete(tabId, 15000);
    if (await isStopped()) return;
    await sleep(rand(1200, 2800));

    // 5 — scroll / read (only if enabled)
    if (cfg.scrollEnabled) {
      if (await isStopped()) return;
      const readStart = Date.now();
      state.status = 'reading';
      await setState(state);
      try { await sendToTab(tabId, { action: 'scroll' }); } catch { /* optional */ }
      readingDurationSec = (Date.now() - readStart) / 1000;
    }

  } catch (e) {
    console.warn(`[BAS] search ${num} failed:`, e.message);
  }

  // ── bail out if stopped during the search ──
  if (await isStopped()) return;

  // ── update counters ──
  state.currentIndex++;
  state.searchesCompleted = state.currentIndex;

  if (state.currentIndex >= state.totalSearches) {
    await setState(state);
    await finishSession();
    return;
  }

  // ── schedule next search ──
  const onBreak = cfg.coffeeBreakEnabled
    && state.currentIndex > 0
    && (state.currentIndex % cfg.coffeeBreakEvery === 0);

  let delaySec;
  if (onBreak) {
    delaySec = cfg.coffeeBreakFixed
      ? cfg.coffeeBreakMinSec
      : randF(cfg.coffeeBreakMinSec, cfg.coffeeBreakMaxSec);
  } else {
    delaySec = cfg.delayFixed
      ? cfg.delayMinSec
      : randF(cfg.delayMinSec, cfg.delayMaxSec);
    if (cfg.includeDelayInReading) {
      delaySec = Math.max(0, delaySec - readingDurationSec);
    }
  }

  delaySec = Math.max(2, delaySec);

  state.status       = onBreak ? 'break' : 'waiting';
  state.nextSearchAt = Date.now() + delaySec * 1000;
  await setState(state);

  if (onBreak) badge(state.currentIndex, state.totalSearches, '#eab308');

  if (delaySec < 30) {
    _nextTimer = setTimeout(() => { _nextTimer = null; executeSearch(); }, delaySec * 1000);
  } else {
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: delaySec / 60 });
  }
}

// ─── Session lifecycle ───────────────────────────────────────

async function startSession(count) {
  await clearState();

  const settings = await loadSettings();
  const { queries, hasTrends, trendCount } = await buildQueries(count);
  const tab = await chrome.tabs.create({ url: 'https://www.bing.com/', active: false });

  const state = {
    isRunning: true,
    queries,
    currentIndex: 0,
    totalSearches: count,
    searchesCompleted: 0,
    tabId: tab.id,
    startTime: Date.now(),
    status: 'starting',
    lastQuery: '',
    hasTrends,
    trendCount,
    nextSearchAt: null,
    settings
  };
  await setState(state);
  badge(0, count);

  await sleep(rand(2000, 3500));
  await executeSearch();
}

async function stopSession() {
  await chrome.alarms.clear(ALARM_NAME);
  if (_nextTimer) { clearTimeout(_nextTimer); _nextTimer = null; }

  const state = await getState();
  if (state) {
    // Tell the content script to abort any in-progress typing/scrolling
    try { await chrome.tabs.sendMessage(state.tabId, { action: 'abort' }); }
    catch { /* tab may be gone */ }

    state.isRunning = false;
    state.status = 'stopped';
    state.nextSearchAt = null;
    await setState(state);
  }
  chrome.action.setBadgeText({ text: '' });
}

async function finishSession() {
  await chrome.alarms.clear(ALARM_NAME);
  const state = await getState();
  if (state) {
    state.isRunning = false;
    state.status = 'complete';
    state.nextSearchAt = null;
    await setState(state);
  }
  chrome.action.setBadgeText({ text: '\u2713' });
  chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 60000);
}

// ─── Event wiring ────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) executeSearch();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.action) {
    case 'startSession':
      startSession(msg.count).then(() => sendResponse({ ok: true }));
      return true;
    case 'stopSession':
      stopSession().then(() => sendResponse({ ok: true }));
      return true;
    case 'getState':
      getState().then(s => sendResponse(s));
      return true;
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;
    case 'clearState':
      clearState().then(() => sendResponse({ ok: true }));
      return true;
  }
});

chrome.tabs.onRemoved.addListener(async tabId => {
  const s = await getState();
  if (s?.isRunning && s.tabId === tabId) await stopSession();
});

chrome.runtime.onInstalled.addListener(details => {
  clearState();
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});
