const $ = s => document.querySelector(s);

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

// ── Slider ──
elSlider.addEventListener('input', () => { elCountVal.textContent = elSlider.value; });

// ── Start ──
elStartBtn.addEventListener('click', () => {
  const count = parseInt(elSlider.value, 10);
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

// ── Reset ──
elResetBtn.addEventListener('click', () => {
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
