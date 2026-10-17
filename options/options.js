// ── Store URLs ──
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

const SETTINGS_KEY = 'basSettings';
const DEFAULTS = {
  defaultSearchCount: 30,
  delayMinSec: 36,
  delayMaxSec: 108,
  delayFixed: false,
  coffeeBreakEnabled: true,
  coffeeBreakEvery: 5,
  coffeeBreakMinSec: 180,
  coffeeBreakMaxSec: 360,
  coffeeBreakFixed: false,
  useTrends: true,
  scrollEnabled: true,
  includeDelayInReading: false
};

const el = {
  defaultCount:  document.getElementById('defaultCount'),
  delayFixed:    document.getElementById('delayFixed'),
  delayMin:      document.getElementById('delayMin'),
  delayMax:      document.getElementById('delayMax'),
  delayMinLabel: document.getElementById('delayMinLabel'),
  delayMaxRow:   document.getElementById('delayMaxRow'),
  coffeeEnabled: document.getElementById('coffeeEnabled'),
  coffeeEvery:   document.getElementById('coffeeEvery'),
  coffeeFixed:   document.getElementById('coffeeFixed'),
  coffeeMin:     document.getElementById('coffeeMin'),
  coffeeMax:     document.getElementById('coffeeMax'),
  coffeeMinLabel:document.getElementById('coffeeMinLabel'),
  coffeeMaxRow:  document.getElementById('coffeeMaxRow'),
  coffeeFields:  document.getElementById('coffeeFields'),
  useTrends:     document.getElementById('useTrends'),
  scrollEnabled: document.getElementById('scrollEnabled'),
  includeDelay:  document.getElementById('includeDelay'),
  toast:         document.getElementById('toast')
};

// ── Load saved settings ──
chrome.storage.local.get(SETTINGS_KEY, d => {
  const s = Object.assign({}, DEFAULTS, d[SETTINGS_KEY]);
  el.defaultCount.value    = s.defaultSearchCount;
  el.delayFixed.checked    = s.delayFixed;
  el.delayMin.value        = s.delayMinSec;
  el.delayMax.value        = s.delayMaxSec;
  el.coffeeEnabled.checked = s.coffeeBreakEnabled;
  el.coffeeEvery.value     = s.coffeeBreakEvery;
  el.coffeeFixed.checked   = s.coffeeBreakFixed;
  el.coffeeMin.value       = s.coffeeBreakMinSec;
  el.coffeeMax.value       = s.coffeeBreakMaxSec;
  el.useTrends.checked     = s.useTrends;
  el.scrollEnabled.checked = s.scrollEnabled;
  el.includeDelay.checked  = s.includeDelayInReading;
  syncDelayUI();
  syncCoffeeUI();
  syncBehaviorUI();
});

function syncDelayUI() {
  const fixed = el.delayFixed.checked;
  el.delayMaxRow.style.display = fixed ? 'none' : '';
  el.delayMinLabel.textContent = fixed ? 'Duration' : 'Minimum';
}

function syncCoffeeUI() {
  const on = el.coffeeEnabled.checked;
  el.coffeeFields.style.opacity = on ? '1' : '0.35';
  el.coffeeFields.style.pointerEvents = on ? 'auto' : 'none';

  const fixed = el.coffeeFixed.checked;
  el.coffeeMaxRow.style.display = fixed ? 'none' : '';
  el.coffeeMinLabel.textContent = fixed ? 'Duration' : 'Minimum duration';
}

function syncBehaviorUI() {
  const scrollOn = el.scrollEnabled.checked;
  el.includeDelay.disabled = !scrollOn;
  el.includeDelay.closest('.toggle-row').style.opacity = scrollOn ? '1' : '0.35';
  if (!scrollOn) el.includeDelay.checked = false;
}

let toastTimer;
function save() {
  const s = {
    defaultSearchCount:  Math.max(1, Math.min(500, +el.defaultCount.value || DEFAULTS.defaultSearchCount)),
    delayFixed:          el.delayFixed.checked,
    delayMinSec:         Math.max(10, +el.delayMin.value || DEFAULTS.delayMinSec),
    delayMaxSec:         Math.max(10, +el.delayMax.value || DEFAULTS.delayMaxSec),
    coffeeBreakEnabled:  el.coffeeEnabled.checked,
    coffeeBreakEvery:    Math.max(2, +el.coffeeEvery.value || DEFAULTS.coffeeBreakEvery),
    coffeeBreakFixed:    el.coffeeFixed.checked,
    coffeeBreakMinSec:   Math.max(10, +el.coffeeMin.value || DEFAULTS.coffeeBreakMinSec),
    coffeeBreakMaxSec:   Math.max(10, +el.coffeeMax.value || DEFAULTS.coffeeBreakMaxSec),
    useTrends:             el.useTrends.checked,
    scrollEnabled:         el.scrollEnabled.checked,
    includeDelayInReading: el.includeDelay.checked
  };
  if (s.delayMaxSec < s.delayMinSec) s.delayMaxSec = s.delayMinSec;
  if (s.coffeeBreakMaxSec < s.coffeeBreakMinSec) s.coffeeBreakMaxSec = s.coffeeBreakMinSec;

  chrome.storage.local.set({ [SETTINGS_KEY]: s });

  clearTimeout(toastTimer);
  el.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 1400);
}

document.querySelectorAll('input').forEach(inp => {
  inp.addEventListener('change', () => {
    if (inp === el.coffeeEnabled || inp === el.coffeeFixed) syncCoffeeUI();
    if (inp === el.delayFixed) syncDelayUI();
    if (inp === el.scrollEnabled) syncBehaviorUI();
    save();
  });
});

// ── Update banner ──
async function loadUpdateBanner() {
  const { updateAvailable, latestVersion } = await chrome.storage.local.get(['updateAvailable', 'latestVersion']);
  if (!updateAvailable || !latestVersion) return false;

  const banner = document.getElementById('update-banner');
  const btnUpdate = document.getElementById('opt-update-btn');

  document.getElementById('opt-update-version').textContent = latestVersion;
  btnUpdate.href = getStoreUrl();
  banner.classList.remove('hidden');
  return true;
}

// ── Rate banner ──
async function loadRateBanner() {
  const data = await chrome.storage.local.get(['rated', 'remindRateAfter']);

  if (data.rated) return;
  if (data.remindRateAfter && Date.now() < data.remindRateAfter) return;

  const banner   = document.getElementById('rate-banner');
  const btnRate  = document.getElementById('opt-rate-now');
  const btnLater = document.getElementById('opt-rate-later');

  banner.classList.remove('hidden');
  btnRate.href = getReviewUrl();

  btnRate.addEventListener('click', async () => {
    await chrome.storage.local.set({ rated: true });
    banner.classList.add('hidden');
  });

  btnLater.addEventListener('click', async () => {
    const remindAt = Date.now() + (2 * 24 * 60 * 60 * 1000);
    await chrome.storage.local.set({ remindRateAfter: remindAt });
    banner.classList.add('hidden');
  });
}
// ── What's New ──
async function loadWhatsNew() {
  const { showWhatsNew } = await chrome.storage.local.get('showWhatsNew');
  if (showWhatsNew) {
    document.getElementById('whats-new-dot').classList.remove('hidden');
  }
}

document.getElementById('btn-whats-new').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/whats-new.html') });
  document.getElementById('whats-new-dot').classList.add('hidden');
  chrome.storage.local.set({ showWhatsNew: false });
});

loadWhatsNew();
loadUpdateBanner().then(hasUpdate => {
  if (!hasUpdate) loadRateBanner();
});
