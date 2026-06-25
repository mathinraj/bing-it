(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // ─── Search input helpers ─────────────────────────────────

  function findSearchInput() {
    return document.querySelector('#sb_form_q')
      || document.querySelector('textarea[name="q"]')
      || document.querySelector('input[name="q"]')
      || document.querySelector('#searchbox input[type="search"]');
  }

  async function typeQuery(query) {
    const input = findSearchInput();
    if (!input) throw new Error('Search input not found');

    input.click();
    input.focus();
    await sleep(rand(200, 500));

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(rand(100, 300));

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: char, code: `Key${char.toUpperCase()}`,
        keyCode: char.charCodeAt(0), bubbles: true
      }));

      input.value += char;

      input.dispatchEvent(new InputEvent('input', {
        data: char, inputType: 'insertText', bubbles: true
      }));

      input.dispatchEvent(new KeyboardEvent('keyup', {
        key: char, code: `Key${char.toUpperCase()}`,
        keyCode: char.charCodeAt(0), bubbles: true
      }));

      let delay;
      if (char === ' ') {
        delay = rand(120, 320);
      } else if (Math.random() < 0.08) {
        delay = rand(280, 580);
      } else {
        delay = rand(45, 185);
      }
      await sleep(delay);
    }
  }

  function submitSearch() {
    const input = findSearchInput();
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
      }));
      input.dispatchEvent(new KeyboardEvent('keypress', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
      }));
    }
    const form = document.querySelector('#sb_form')
      || (input && input.closest('form'));
    if (form) form.submit();
  }

  async function simulateReading() {
    await sleep(rand(2000, 4000));

    const maxScroll = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;

    if (maxScroll <= 0) {
      await sleep(rand(2000, 5000));
      return;
    }

    let pos = 0;
    const steps = rand(3, 8);

    for (let i = 0; i < steps; i++) {
      const jump = rand(80, 380);
      pos = Math.min(pos + jump, maxScroll);
      window.scrollTo({ top: pos, behavior: 'smooth' });
      await sleep(rand(800, 3500));
    }

    if (Math.random() < 0.3 && pos > 200) {
      window.scrollTo({ top: pos - rand(100, 280), behavior: 'smooth' });
      await sleep(rand(600, 1800));
    }

    await sleep(rand(500, 2000));
  }

  // ─── Message listener ─────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'type') {
      typeQuery(msg.query)
        .then(() => sendResponse({ success: true }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (msg.action === 'submit') {
      try { submitSearch(); sendResponse({ success: true }); }
      catch (e) { sendResponse({ success: false, error: e.message }); }
      return false;
    }
    if (msg.action === 'scroll') {
      simulateReading()
        .then(() => sendResponse({ success: true }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (msg.action === 'ping') {
      sendResponse({ alive: true });
      return false;
    }
  });

  // ─── Floating overlay on Bing page ────────────────────────

  const COLORS = {
    accent:  '#06b6d4',
    warning: '#eab308',
    success: '#10b981',
    dim:     '#94a3b8',
    bg:      'rgba(10, 14, 23, 0.93)',
    border:  'rgba(255,255,255,0.07)'
  };

  const STATUS_TEXT = {
    starting:  'Preparing\u2026',
    searching: 'Typing query',
    reading:   'Reading results',
    waiting:   'Next search in',
    break:     'Coffee break \u2615',
    complete:  'Session complete',
    stopped:   'Stopped'
  };

  function createOverlay() {
    let el = document.getElementById('bas-overlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'bas-overlay';
    Object.assign(el.style, {
      all: 'initial',
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: '12px',
      lineHeight: '1.5',
      color: '#e2e8f0',
      background: COLORS.bg,
      backdropFilter: 'blur(12px)',
      border: `1px solid ${COLORS.border}`,
      borderRadius: '12px',
      padding: '14px 18px',
      minWidth: '190px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      userSelect: 'none',
      transition: 'opacity .3s'
    });

    el.innerHTML = [
      '<div id="bas-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">',
      '  <div style="display:flex;align-items:center;gap:6px;">',
      `    <span id="bas-dot" style="width:8px;height:8px;border-radius:50%;background:${COLORS.accent};display:inline-block;"></span>`,
      '    <span style="font-size:11px;font-weight:600;color:#94a3b8;">Bing Auto Search</span>',
      '  </div>',
      `  <span id="bas-close" style="cursor:pointer;font-size:16px;line-height:1;color:#64748b;padding:0 2px;" title="Hide overlay">\u00d7</span>`,
      '</div>',
      '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;">',
      '  <span id="bas-prog" style="font-size:11px;color:#94a3b8;">\u2014</span>',
      '  <span id="bas-pct" style="font-size:10px;color:#64748b;">0%</span>',
      '</div>',
      `<div style="width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:12px;overflow:hidden;">`,
      `  <div id="bas-bar" style="height:100%;width:0%;background:linear-gradient(90deg,${COLORS.accent},#22d3ee);border-radius:2px;transition:width .5s;"></div>`,
      '</div>',
      `<div id="bas-time" style="font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;color:${COLORS.accent};line-height:1;margin-bottom:6px;">\u2014</div>`,
      '<div id="bas-status" style="font-size:11px;color:#94a3b8;">\u2014</div>'
    ].join('');

    document.body.appendChild(el);

    document.getElementById('bas-close').addEventListener('click', () => {
      el.style.display = 'none';
    });

    return el;
  }

  function removeOverlay() {
    const el = document.getElementById('bas-overlay');
    if (el) el.remove();
  }

  function renderOverlay(state) {
    const overlay = createOverlay();
    if (overlay.style.display === 'none') return;

    const cur = state.searchesCompleted || 0;
    const tot = state.totalSearches || 1;
    const pct = Math.round((cur / tot) * 100);

    document.getElementById('bas-prog').textContent = `${cur} / ${tot} searches`;
    document.getElementById('bas-pct').textContent = `${pct}%`;
    document.getElementById('bas-bar').style.width = `${pct}%`;

    const dot = document.getElementById('bas-dot');
    const timeEl = document.getElementById('bas-time');
    const statusEl = document.getElementById('bas-status');
    const isWaiting = state.status === 'waiting' || state.status === 'break';

    if (isWaiting && state.nextSearchAt) {
      const left = Math.max(0, Math.ceil((state.nextSearchAt - Date.now()) / 1000));
      const m = Math.floor(left / 60);
      const s = left % 60;
      timeEl.textContent = m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
      const isBreak = state.status === 'break';
      timeEl.style.color = isBreak ? COLORS.warning : COLORS.accent;
      dot.style.background = isBreak ? COLORS.warning : COLORS.accent;
    } else if (state.status === 'complete') {
      timeEl.textContent = '\u2713 Done';
      timeEl.style.color = COLORS.success;
      dot.style.background = COLORS.success;
    } else {
      timeEl.textContent = '\u2022\u2022\u2022';
      timeEl.style.color = COLORS.accent;
      dot.style.background = state.status === 'reading' ? COLORS.success : COLORS.accent;
    }

    statusEl.textContent = STATUS_TEXT[state.status] || state.status;
  }

  // Poll background for state and update the overlay
  let overlayPoll = null;

  async function initOverlay() {
    try {
      const state = await chrome.runtime.sendMessage({ action: 'getState' });
      if (state && (state.isRunning || state.status === 'complete')) {
        renderOverlay(state);
        if (!overlayPoll) {
          overlayPoll = setInterval(async () => {
            try {
              const s = await chrome.runtime.sendMessage({ action: 'getState' });
              if (s && (s.isRunning || s.status === 'complete')) {
                renderOverlay(s);
              } else {
                removeOverlay();
                clearInterval(overlayPoll);
                overlayPoll = null;
              }
            } catch { /* extension context gone */ }
          }, 1000);
        }
      }
    } catch { /* extension not ready */ }
  }

  initOverlay();
})();
