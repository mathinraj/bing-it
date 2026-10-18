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
  delayMinSec: 10,
  delayMaxSec: 10,
  delayFixed: true,
  coffeeBreakEnabled: false,
  coffeeBreakEvery: 5,
  coffeeBreakMinSec: 180,
  coffeeBreakMaxSec: 360,
  coffeeBreakFixed: false,
  useTrends: true,
  scrollEnabled: false,
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
// ── Feature Request (EmailJS) ──
const EMAILJS_SERVICE_ID  = 'service_em2o2a6';
const EMAILJS_TEMPLATE_ID = 'template_6595ut4';
const EMAILJS_PUBLIC_KEY  = 'R2Yro3gG1FbXS9fJm';

const frToggle  = document.getElementById('fr-toggle');
const frBody    = document.getElementById('fr-body');
const frChevron = document.getElementById('fr-chevron');
const frEmail   = document.getElementById('fr-email');
const frCategory = document.getElementById('fr-category');
const frMessage = document.getElementById('fr-message');
const btnSendFR = document.getElementById('btn-send-fr');
const frMsg     = document.getElementById('fr-msg');

frToggle.addEventListener('click', () => {
  const isOpen = frBody.classList.toggle('expanded');
  frChevron.classList.toggle('open', isOpen);
});

btnSendFR.addEventListener('click', async () => {
  const message = frMessage.value.trim();

  if (message.length < 10) {
    frMsg.textContent = 'Please enter at least 10 characters.';
    frMsg.className = 'fr-msg error';
    return;
  }

  btnSendFR.disabled = true;
  btnSendFR.textContent = 'Sending…';

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id:     EMAILJS_PUBLIC_KEY,
        template_params: {
          from_email: frEmail.value.trim() || 'Not provided',
          category:   '[bing it] ' + frCategory.value,
          message:    '[bing it] ' + message,
          timestamp:  new Date().toISOString(),
          version:    chrome.runtime.getManifest().version
        }
      })
    });

    if (res.ok) {
      frMsg.textContent = 'Thank you! Your request has been sent.';
      frMsg.className = 'fr-msg success';
      frEmail.value = '';
      frMessage.value = '';
      frCategory.value = 'feature';
    } else {
      throw new Error();
    }
  } catch (_) {
    frMsg.textContent = 'Failed to send. Please try again later.';
    frMsg.className = 'fr-msg error';
  }

  btnSendFR.disabled = false;
  btnSendFR.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
    Send`;
});

// ── Support Strip (rate button) ──
(async function loadSupportStrip() {
  const rateStrip = document.getElementById('btn-rate-strip');
  const { rated } = await chrome.storage.local.get('rated');
  if (rated && rateStrip) {
    rateStrip.classList.add('hidden');
  } else if (rateStrip) {
    rateStrip.href = getReviewUrl();
    rateStrip.addEventListener('click', async () => {
      await chrome.storage.local.set({ rated: true });
    });
  }
})();

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

// ── Pin-to-toolbar (options) ──
function loadPinBanner() {
  chrome.runtime.sendMessage({ action: 'checkPinToToolbar' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    if (!res.isPinned) {
      document.getElementById('opt-pin-banner').classList.remove('hidden');
    }
  });
}

document.getElementById('opt-pin-dismiss').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'dismissPinToToolbar' });
  document.getElementById('opt-pin-banner').classList.add('hidden');
});

// ── Guided Tour ──
const TOUR_STEPS = [
  {
    target: 'card-count',
    title: 'Default Search Count',
    desc: 'This sets how many searches the popup starts with by default. For example, set it to 35 and every time you open the popup, the slider will already be at 35. You can always change it before clicking "Bing it!"'
  },
  {
    target: 'card-delay',
    title: 'Delay Between Searches',
    desc: 'After each search completes, the extension waits before doing the next one. "Fixed" means the same wait every time (e.g. 10 seconds). Turn it off for a random wait between a min and max value — this makes the pattern look more natural.'
  },
  {
    target: 'card-coffee',
    title: 'Coffee Break',
    desc: 'This adds a longer pause after every few searches — like a real person taking a break. For example: after every 5 searches, wait 3–6 minutes. Great for making activity look less robotic. Disabled by default for faster sessions.'
  },
  {
    target: 'card-behavior',
    title: 'Behavior Settings',
    desc: 'Google Trends pulls real trending topics as search queries, so your searches look diverse and current. Scroll simulates reading the results page. "Include delay in reading time" makes the delay timer run during scrolling so sessions finish faster.'
  },
  {
    target: 'card-feedback',
    title: 'Feature Request / Bug Report',
    desc: 'Got an idea for a new feature? Found a bug? Expand this section and send it directly to the developer. No account needed — just type your message and hit Send.'
  }
];

let tourStep = 0;
let prevHighlight = null;

function showTourStep(step) {
  const overlay  = document.getElementById('tour-overlay');
  const popup    = document.getElementById('tour-popup');
  const titleEl  = document.getElementById('tour-title');
  const descEl   = document.getElementById('tour-desc');
  const indicator = document.getElementById('tour-step-indicator');
  const nextBtn  = document.getElementById('tour-next');

  if (prevHighlight) prevHighlight.classList.remove('tour-highlight');

  if (step >= TOUR_STEPS.length) {
    overlay.classList.add('hidden');
    chrome.storage.local.set({ showTour: false });
    return;
  }

  const s = TOUR_STEPS[step];
  const target = document.getElementById(s.target);
  if (!target) { showTourStep(step + 1); return; }

  target.classList.add('tour-highlight');
  prevHighlight = target;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const backBtn = document.getElementById('tour-back');

  titleEl.textContent = s.title;
  descEl.textContent = s.desc;
  nextBtn.innerHTML = step === TOUR_STEPS.length - 1 ? 'Got it!' : 'Next &rarr;';
  backBtn.classList.toggle('hidden', step === 0);

  indicator.innerHTML = TOUR_STEPS.map((_, i) =>
    `<div class="tour-dot ${i === step ? 'active' : ''}"></div>`
  ).join('');

  setTimeout(() => {
    const rect = target.getBoundingClientRect();
    const popupH = popup.offsetHeight;
    let top = rect.bottom + 12;
    if (top + popupH > window.innerHeight - 16) {
      top = rect.top - popupH - 12;
    }
    top = Math.max(16, Math.min(top, window.innerHeight - popupH - 16));
    popup.style.top = top + 'px';
    popup.style.left = Math.max(16, (window.innerWidth - popup.offsetWidth) / 2) + 'px';
  }, 350);
}

async function initTour() {
  const { showTour } = await chrome.storage.local.get('showTour');
  if (!showTour) return;

  tourStep = 0;
  document.getElementById('tour-overlay').classList.remove('hidden');
  showTourStep(0);
}

document.getElementById('tour-next').addEventListener('click', () => {
  tourStep++;
  showTourStep(tourStep);
});

document.getElementById('tour-back').addEventListener('click', () => {
  if (tourStep > 0) {
    tourStep--;
    showTourStep(tourStep);
  }
});

document.getElementById('tour-skip').addEventListener('click', () => {
  if (prevHighlight) prevHighlight.classList.remove('tour-highlight');
  document.getElementById('tour-overlay').classList.add('hidden');
  chrome.storage.local.set({ showTour: false });
});

document.getElementById('btn-retour').addEventListener('click', () => {
  tourStep = 0;
  document.getElementById('tour-overlay').classList.remove('hidden');
  showTourStep(0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

loadWhatsNew();
loadPinBanner();
loadUpdateBanner().then(hasUpdate => {
  if (!hasUpdate) loadRateBanner();
});
setTimeout(initTour, 600);
