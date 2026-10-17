const $ = s => document.querySelector(s);

// ── Store URLs ──
const REMIND_DAYS = 2;

const REVIEW_URLS = {
  chrome:  'https://chromewebstore.google.com/detail/Bing%20it%20%E2%80%94%20Smart%20Auto%20Searcher/gldhjncdmgpileambimhpjmeoejgclen',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/bing-it/reviews/'
};

const STORE_URLS = {
  chrome:  'https://chromewebstore.google.com/detail/Bing%20it%20%E2%80%94%20Smart%20Auto%20Searcher/gldhjncdmgpileambimhpjmeoejgclen',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/bing-it/'
};

function getReviewUrl() {
  return REVIEW_URLS[BINGIT_STORE] || 'https://bingit.vercel.app';
}

function getStoreUrl() {
  return STORE_URLS[BINGIT_STORE] || 'https://bingit.vercel.app';
}

async function shouldShowRate() {
  const data = await chrome.storage.local.get(['rated', 'remindRateAfter']);
  if (data.rated) return false;
  if (data.remindRateAfter && Date.now() < data.remindRateAfter) return false;
  return true;
}

const elSetup    = $('#setup');
const elProgress = $('#progress');
const elDone     = $('#done');
const elSlider   = $('#count');
const elCountVal = $('#countVal');
const elStartBtn = $('#startBtn');
const elStopBtn  = $('#stopBtn');
const elResetBtn = $('#resetBtn');
const elProgText = $('#progText');
const elProgBar  = $('#progBar');
const elStatus   = $('#statusText');
const elQuery    = $('#queryText');
const elTrends   = $('#trendsText');
const elElapsed  = $('#elapsed');
const elSummary  = $('#doneSummary');

// ── Load default count from settings ──
chrome.storage.local.get('basSettings', d => {
  const count = (d.basSettings && d.basSettings.defaultSearchCount) || 30;
  elSlider.value = Math.min(count, parseInt(elSlider.max, 10));
  elCountVal.value = count;
});

// ── Slider ↔ Input sync ──
elSlider.addEventListener('input', () => {
  elCountVal.value = elSlider.value;
});
elCountVal.addEventListener('input', () => {
  const v = parseInt(elCountVal.value, 10);
  if (!isNaN(v) && v >= 1) {
    elSlider.value = Math.min(v, parseInt(elSlider.max, 10));
  }
});
elCountVal.addEventListener('blur', () => {
  const v = Math.max(1, Math.min(500, parseInt(elCountVal.value, 10) || 30));
  elCountVal.value = v;
});

// ── Start ──
elStartBtn.addEventListener('click', () => {
  const count = Math.max(1, parseInt(elCountVal.value, 10) || 30);
  elStartBtn.disabled = true;
  chrome.runtime.sendMessage({ action: 'startSession', count });
  showView('progress');
});

// ── Stop ──
elStopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopSession' });
  showView('setup');
  elStartBtn.disabled = false;
});

// ── Reset (clear completed state from storage) ──
elResetBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearState' });
  showView('setup');
  elStartBtn.disabled = false;
});

// ── Open options page ──
$('#openSettings').addEventListener('click', e => {
  e.preventDefault();
  chrome.runtime.sendMessage({ action: 'openOptions' });
});

// ── Render ──
function render(state) {
  if (!state) { showView('setup'); return; }

  if (state.status === 'complete') {
    showView('done');
    const mins = Math.round((Date.now() - state.startTime) / 60000);
    elSummary.textContent = `${state.totalSearches} searches in ~${mins} min`;
    return;
  }

  if (state.status === 'stopped' || !state.isRunning) {
    showView('setup');
    elStartBtn.disabled = false;
    return;
  }

  showView('progress');
  const cur = state.searchesCompleted || 0;
  const tot = state.totalSearches || 1;
  elProgText.textContent = `${cur} / ${tot}`;
  elProgBar.style.width  = `${(cur / tot) * 100}%`;
  elStatus.textContent   = formatStatus(state.status, state);
  elStatus.dataset.status = state.status;
  elQuery.textContent    = state.lastQuery || '\u2014';
  elTrends.textContent   = state.hasTrends ? `${state.trendCount} queries` : 'Unavailable (using fallback)';
  elElapsed.textContent  = elapsed(state.startTime);
}

function formatStatus(status, state) {
  const labels = {
    starting:  'Starting\u2026',
    searching: 'Typing query\u2026',
    reading:   'Reading results\u2026',
    waiting:   'Waiting\u2026',
    break:     'Coffee break \u2615',
    complete:  'Done!',
    stopped:   'Stopped'
  };
  if (status === 'break' || status === 'waiting') {
    const left = Math.max(0, Math.ceil(((state.nextSearchAt || 0) - Date.now()) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    const t = m > 0 ? `${m}m ${s}s` : `${s}s`;
    return `${labels[status]} (${t})`;
  }
  return labels[status] || status;
}

function elapsed(start) {
  if (!start) return '0:00';
  const s = Math.floor((Date.now() - start) / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function showView(name) {
  elSetup.classList.toggle('hidden', name !== 'setup');
  elProgress.classList.toggle('hidden', name !== 'progress');
  elDone.classList.toggle('hidden', name !== 'done');
}

// ── Poll ──
async function poll() {
  const state = await chrome.runtime.sendMessage({ action: 'getState' });
  render(state);
}
poll();
setInterval(poll, 1000);

chrome.storage.onChanged.addListener(changes => {
  if (changes.searchState) render(changes.searchState.newValue);
});

// ── Rate prompt ──
document.getElementById('btn-rate-now').addEventListener('click', async () => {
  await chrome.storage.local.set({ rated: true });
  chrome.tabs.create({ url: getReviewUrl() });
  window.close();
});

document.getElementById('btn-rate-later').addEventListener('click', async () => {
  const remindAt = Date.now() + (REMIND_DAYS * 24 * 60 * 60 * 1000);
  await chrome.storage.local.set({ remindRateAfter: remindAt });
  document.getElementById('rate-prompt').classList.add('hidden');
});

async function loadRatePrompt() {
  if (await shouldShowRate()) {
    document.getElementById('rate-prompt').classList.remove('hidden');
  }
}
loadRatePrompt();
