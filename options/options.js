const SETTINGS_KEY = 'basSettings';
const DEFAULTS = {
  delayMinSec: 36,
  delayMaxSec: 108,
  coffeeBreakEnabled: true,
  coffeeBreakEvery: 5,
  coffeeBreakMinSec: 180,
  coffeeBreakMaxSec: 360,
  includeDelayInReading: false
};

const el = {
  delayMin:      document.getElementById('delayMin'),
  delayMax:      document.getElementById('delayMax'),
  coffeeEnabled: document.getElementById('coffeeEnabled'),
  coffeeEvery:   document.getElementById('coffeeEvery'),
  coffeeMin:     document.getElementById('coffeeMin'),
  coffeeMax:     document.getElementById('coffeeMax'),
  coffeeFields:  document.getElementById('coffeeFields'),
  includeDelay:  document.getElementById('includeDelay'),
  toast:         document.getElementById('toast')
};

// ── Load saved settings ──
chrome.storage.local.get(SETTINGS_KEY, d => {
  const s = Object.assign({}, DEFAULTS, d[SETTINGS_KEY]);
  el.delayMin.value      = s.delayMinSec;
  el.delayMax.value      = s.delayMaxSec;
  el.coffeeEnabled.checked = s.coffeeBreakEnabled;
  el.coffeeEvery.value   = s.coffeeBreakEvery;
  el.coffeeMin.value     = s.coffeeBreakMinSec;
  el.coffeeMax.value     = s.coffeeBreakMaxSec;
  el.includeDelay.checked = s.includeDelayInReading;
  syncCoffeeUI();
});

function syncCoffeeUI() {
  const on = el.coffeeEnabled.checked;
  el.coffeeFields.style.opacity = on ? '1' : '0.35';
  el.coffeeFields.style.pointerEvents = on ? 'auto' : 'none';
}

let toastTimer;
function save() {
  const s = {
    delayMinSec:        Math.max(10, +el.delayMin.value || DEFAULTS.delayMinSec),
    delayMaxSec:        Math.max(10, +el.delayMax.value || DEFAULTS.delayMaxSec),
    coffeeBreakEnabled: el.coffeeEnabled.checked,
    coffeeBreakEvery:   Math.max(2, +el.coffeeEvery.value || DEFAULTS.coffeeBreakEvery),
    coffeeBreakMinSec:  Math.max(10, +el.coffeeMin.value || DEFAULTS.coffeeBreakMinSec),
    coffeeBreakMaxSec:  Math.max(10, +el.coffeeMax.value || DEFAULTS.coffeeBreakMaxSec),
    includeDelayInReading: el.includeDelay.checked
  };
  if (s.delayMaxSec < s.delayMinSec) s.delayMaxSec = s.delayMinSec;
  if (s.coffeeBreakMaxSec < s.coffeeBreakMinSec) s.coffeeBreakMaxSec = s.coffeeBreakMinSec;

  chrome.storage.local.set({ [SETTINGS_KEY]: s });

  clearTimeout(toastTimer);
  el.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 1400);
}

// Auto-save on any input change
document.querySelectorAll('input').forEach(inp => {
  inp.addEventListener('change', () => {
    if (inp === el.coffeeEnabled) syncCoffeeUI();
    save();
  });
});
