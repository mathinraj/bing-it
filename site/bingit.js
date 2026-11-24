/* bing it · the page as a running browser.
   The session in act 3 is a demo, but it is computed, not painted: keystrokes,
   reading scrolls, waits and breaks come from the same rules as the extension's
   scripts/content.js and scripts/background.js, played back against scroll. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var clamp01 = function (x) { return clamp(x, 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);

  var sc = window.ScrollCraft.mount(document.body);

  // ---------------------------------------------------------------- random
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var seed = parseInt(params.get('seed'), 10);
  if (isNaN(seed)) seed = (Math.random() * 1e9) | 0;

  // ---------------------------------------------------------------- region
  // Same lookup as background.js detectCountryCode().
  function detectCountryCode() {
    try {
      var o = Intl.DateTimeFormat().resolvedOptions();
      var tz = o.timeZone || '';
      var locale = o.locale || navigator.language || 'en-US';
      var map = {
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
      if (map[tz]) return map[tz];
      var region = locale.split('-')[1] || locale.split('_')[1];
      if (region && region.length === 2) return region.toUpperCase();
    } catch (e) {}
    return 'US';
  }
  var geo = (params.get('geo') || detectCountryCode()).toUpperCase();

  // --------------------------------------------------------------- formats
  var timeFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
  function clockText(d) {
    return timeFmt.formatToParts(d).filter(function (p) { return p.type !== 'dayPeriod'; })
      .map(function (p) { return p.value; }).join('').trim();
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + ' s';
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return s ? m + ' min ' + s + ' s' : m + ' min';
    var h = Math.floor(m / 60);
    return h + ' h ' + (m % 60) + ' min';
  }
  function roughDur(sec) {
    if (sec < 90) return 'about ' + Math.round(sec) + ' s';
    var m = Math.round(sec / 60);
    if (m < 60) return 'about ' + m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return 'about ' + h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  // The overlay's own countdown format, from content.js renderOverlay().
  function overlayLeft(sec) {
    var left = Math.max(0, Math.ceil(sec));
    var m = Math.floor(left / 60), s = left % 60;
    return m > 0 ? m + 'm ' + String(s).padStart(2, '0') + 's' : s + 's';
  }

  // ------------------------------------------------------------------ data
  var FALLBACK = [
    'how to set up dual monitors', 'best note taking apps', 'how to fix slow wifi connection',
    'how to backup photos to cloud', 'best free antivirus software', 'how to block spam emails',
    'best wireless mouse for productivity', 'how to recover deleted files', 'best ad blocker for browser'
  ];
  var pool = FALLBACK.slice();
  var poolStats = { avgLen: 31.5, spaceFrac: 0.15 };

  function shuffled(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pickQueue(list) {
    var rnd = mulberry32(seed ^ 0x9e3779b9);
    var clean = list.filter(function (q) { return /^[\x20-\x7E]+$/.test(q) && q.length <= 44; });
    if (clean.length < 9) clean = FALLBACK.slice();
    var a = shuffled(clean, rnd);
    var firstAt = a.findIndex(function (q) { return q.length >= 20 && q.length <= 32; });
    if (firstAt > 0) a.unshift(a.splice(firstAt, 1)[0]);
    return a.slice(0, 9);
  }
  var queue = pickQueue(pool);

  // ----------------------------------------------------------- shared count
  var count = 30;
  function setCount(n, from) {
    n = clamp(Math.round(+n) || 30, 1, 500);
    count = n;
    $$('[data-count]').forEach(function (el) {
      if (el === from) return;
      el.value = el.type === 'range' ? clamp(n, +el.min, +el.max) : n;
    });
    $$('[data-count-out]').forEach(function (o) { o.textContent = n; });
    if (S && byId.session && (scrollY < byId.session.top - vh || scrollY > byId.session.top + byId.session.height)) buildSession();
    forecast();
    renderHistory();
    frame(true);
  }
  $$('[data-count]').forEach(function (el) {
    el.addEventListener('input', function () { if (el.value !== '') setCount(el.value, el); });
    el.addEventListener('change', function () { setCount(el.value, null); });
  });

  // ------------------------------------------------------- forecast model
  // Expected values of the ranges in background.js executeSearch() and
  // content.js typeQuery() / simulateReading(). Page load is the one number
  // the code does not decide; it is assumed and the panel says so.
  var LOAD_S = 1.5;
  var READ_S = 3 + 5.5 * 2.15 + 0.3 * 1.2 + 1.25;
  function typingSeconds(len, spaceFrac) {
    var perChar = 0.92 * 115 + 0.08 * 430;
    var chars = len * (1 - spaceFrac) * perChar + len * spaceFrac * 220;
    return 0.35 + 0.2 + chars / 1000;
  }
  var opts = $('#opts');
  function num(id, lo, hi, dflt) {
    var v = parseFloat($('#' + id).value);
    return clamp(isNaN(v) ? dflt : v, lo, hi);
  }
  function readSettings() {
    var s = {
      count: count,
      dFixed: $('#o-dfixed').checked,
      dMin: num('o-dmin', 10, 600, 10),
      dMax: num('o-dmax', 10, 600, 30),
      coffee: $('#o-coffee').checked,
      every: Math.round(num('o-every', 2, 50, 5)),
      cMin: num('o-cmin', 10, 1800, 180),
      cMax: num('o-cmax', 10, 1800, 360),
      scroll: $('#o-scroll').checked,
      overlap: $('#o-overlap').checked
    };
    if (s.dMax < s.dMin) s.dMax = s.dMin;
    if (s.cMax < s.cMin) s.cMax = s.cMin;
    return s;
  }
  function model(s) {
    var typing = typingSeconds(poolStats.avgLen, poolStats.spaceFrac);
    var reading = s.scroll ? READ_S : 0;
    var active = 0.7 + typing + 0.425 + LOAD_S + 2.0 + reading;
    var delay = s.dFixed ? s.dMin : (s.dMin + s.dMax) / 2;
    if (s.overlap) delay = Math.max(0, delay - reading);
    delay = Math.max(2, delay);
    var breaks = s.coffee ? Math.floor((s.count - 1) / s.every) : 0;
    var brk = (s.cMin + s.cMax) / 2;
    var total = 2.75 + s.count * active + (s.count - 1 - breaks) * delay + breaks * brk;
    return { typing: typing, reading: reading, active: active, delay: delay, breaks: breaks, brk: brk, total: total };
  }
  function forecast() {
    var s = readSettings();
    $$('[data-when]', opts).forEach(function (f) {
      var w = f.getAttribute('data-when').split(':');
      var on = $('#' + w[0]).checked;
      f.hidden = (w[1] === 'on') !== on;
    });
    $('#o-dmin-l').textContent = s.dFixed ? 'Delay' : 'Minimum';
    var m = model(s);
    $('#fc-total').textContent = roughDur(m.total);
    $('#fc-end').textContent = 'Done around ' + timeFmt.format(new Date(Date.now() + m.total * 1000)) + ' if you start now.';
    $('#fc-each').textContent = Math.round(m.active) + ' s, then ' + fmtDur(m.delay);
    $('#fc-type').textContent = m.typing.toFixed(1) + ' s';
    $('#fc-read').textContent = s.scroll ? Math.round(m.reading) + ' s' : 'off';
    $('#fc-breaks').textContent = s.coffee ? (m.breaks + ' × ' + fmtDur(m.brk)) : 'off';
    var html = '';
    for (var i = 1; i <= s.count; i++) {
      html += '<i class="s" style="--g:' + m.active.toFixed(2) + '"></i>';
      if (i < s.count) {
        var isBreak = s.coffee && i % s.every === 0;
        html += '<i class="' + (isBreak ? 'b' : 'w') + '" style="--g:' + (isBreak ? m.brk : m.delay).toFixed(2) + '"></i>';
      }
    }
    $('#fc-strip').innerHTML = html;
    var dm = model({ count: count, dFixed: true, dMin: 10, dMax: 10, coffee: false, every: 5, cMin: 180, cMax: 360, scroll: false, overlap: false });
    $('#install-est').textContent = (roughDur(dm.total).replace('about', 'About')) + ' with the default settings.';
    lastModel = m;
  }
  var lastModel = null;
  opts.addEventListener('input', forecast);
  opts.addEventListener('change', forecast);

  // ------------------------------------------------------- session build
  // Scroll-mapped windows inside act 3, in act progress.
  var PH = { type: [0, 0.24], load: [0.24, 0.30], read: [0.30, 0.50], wait: [0.50, 0.61], ff: [0.61, 0.79], brk: [0.79, 1] };
  var S = null;

  function typeSchedule(q, rand, R) {
    // content.js typeQuery(): click+focus, clear, then per character.
    var t = rand(200, 500) + rand(100, 300);
    var keys = [];
    for (var i = 0; i < q.length; i++) {
      var ch = q[i], d, think = false;
      if (ch === ' ') d = rand(120, 320);
      else if (R() < 0.08) { d = rand(280, 580); think = true; }
      else d = rand(45, 185);
      keys.push({ ch: ch, at: t, d: d, think: think });
      t += d;
    }
    return { keys: keys, end: t };
  }

  function buildSession() {
    var R = mulberry32(seed);
    var rand = function (lo, hi) { return Math.floor(R() * (hi - lo + 1)) + lo; };
    var log = [];
    var q1 = queue[0];
    var ty = typeSchedule(q1, rand, R);
    log.push({ t: ty.keys.length ? ty.keys[0].at - 1 : 0, k: 'focus', v: 'search box', c: 'is-event' });
    ty.keys.forEach(function (k) {
      log.push({ t: k.at, k: k.ch === ' ' ? 'space' : '"' + k.ch + '"', v: k.d + ' ms' + (k.think ? ' · thinking' : ''), c: k.think ? 'is-pause' : '' });
    });
    var submitAt = ty.end + rand(250, 600);
    var loadAt = submitAt + LOAD_S * 1000;
    var readStart = loadAt + rand(1200, 2800);
    log.push({ t: submitAt, k: 'Enter', v: 'submit', c: 'is-event' });
    log.push({ t: loadAt, k: 'load', v: 'results page', c: 'is-event' });

    // content.js simulateReading(), with the 30% scroll-back.
    var reads = [];
    var t = readStart + rand(2000, 4000);
    var steps = rand(3, 8);
    for (var i = 0; i < steps; i++) {
      var jump = rand(80, 380);
      reads.push({ t: t, jump: jump });
      t += 450 + rand(800, 3500);
    }
    var back = R() < 0.3 ? rand(100, 280) : 0;
    if (back) { reads.push({ t: t, jump: -back }); t += 450 + rand(600, 1800); }
    var readEnd = t + rand(500, 2000);

    var waitEnd = readEnd + 10000;
    log.push({ t: readEnd, k: 'wait', v: '10 s', c: 'is-event' });

    var ff = [];
    t = waitEnd;
    var lastFF = Math.min(5, count);
    for (var k = 2; k <= lastFF; k++) {
      var q = queue[k - 1];
      var start = t + rand(400, 1000);
      var sch = typeSchedule(q, rand, R);
      var typed = start + sch.end;
      var sub = typed + rand(250, 600);
      var done = sub + LOAD_S * 1000 + rand(1200, 2800);
      ff.push({ n: k, q: q, start: start, sch: sch, typed: typed, sub: sub, done: done, waitEnd: done + 10000 });
      log.push({ t: start, k: 'search ' + k, v: q, c: 'is-event' });
      log.push({ t: sub, k: 'Enter', v: 'submit', c: 'is-event' });
      if (k < count) log.push({ t: done, k: k === 5 ? 'break' : 'wait', v: k === 5 ? 'coffee' : '10 s', c: k === 5 ? 'is-break' : 'is-event' });
      t = done + 10000;
    }
    var ffEnd = ff.length ? ff[ff.length - 1].done : waitEnd;
    var brkDur = Math.round(R() * (360 - 180) + 180);
    if (ff.length && ff[ff.length - 1].n === 5 && count > 5) log[log.length - 1].v = 'coffee · ' + fmtDur(brkDur);

    reads.forEach(function (r) { log.push({ t: r.t, k: 'scroll', v: (r.jump > 0 ? '↓ ' : '↑ ') + Math.abs(r.jump) + ' px', c: '' }); });
    log.sort(function (a, b) { return a.t - b.t; });

    S = { q1: q1, ty: ty, submitAt: submitAt, loadAt: loadAt, readStart: readStart, reads: reads, readEnd: readEnd,
          waitEnd: waitEnd, ff: ff, ffEnd: ffEnd, brkDur: brkDur, log: log, shown: -1, query: null };

    var bars = $('#dt-bars');
    bars.innerHTML = ty.keys.map(function (k) {
      var h = Math.round(6 + (k.d / 600) * 80);
      var cls = 'dt__bar' + (k.ch === ' ' ? ' is-space' : '') + (k.think ? ' is-pause' : '');
      return '<span class="' + cls + '" title="' + k.d + ' ms"><i style="--h:' + h + 'px"></i><b>' + (k.ch === ' ' ? '·' : escapeHtml(k.ch)) + '</b></span>';
    }).join('');
    S.barEls = $$('.dt__bar', bars);
    setResults(q1);
  }

  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var RESULT_TITLES = [
    function (q) { return cap(q) + ': a step-by-step guide'; },
    function (q) { return cap(q) + ', explained simply'; },
    function (q) { return 'The quick answer to "' + q + '"'; },
    function (q) { return cap(q) + '? Here is what works'; },
    function (q) { return 'Beginner notes: ' + q; },
    function (q) { return 'Videos for ' + q; },
    function (q) { return cap(q) + ', answered by the community'; },
    function (q) { return 'Everything to know: ' + q; },
    function (q) { return 'Related searches for ' + q; }
  ];
  var RESULT_HOSTS = ['guides.example.com', 'help.example.org', 'answers.example.net', 'learn.example.com', 'notes.example.org', 'video.example.com', 'forum.example.net', 'wiki.example.org', 'search.example.com'];
  var serpList = $('#serp-list'), serpViewport = $('.serp__viewport'), maxScroll = 600;
  function setResults(q) {
    if (S && S.query === q) return;
    if (S) S.query = q;
    serpList.innerHTML = RESULT_TITLES.map(function (f, i) {
      return '<li><span class="r__url"><i></i>' + RESULT_HOSTS[i] + '</span><p class="r__title">' + escapeHtml(f(q)) + '</p><span class="r__snip"></span><span class="r__snip"></span></li>';
    }).join('');
    measure();
  }
  function measure() {
    maxScroll = Math.max(0, serpList.scrollHeight - serpViewport.clientHeight);
  }

  // ------------------------------------------------------------ elements
  var acts = $$('main > [data-sc-act]');
  var byId = {};
  acts.forEach(function (el) { byId[el.id] = { el: el, top: 0, height: 0 }; });
  var heroPopup = $('#hero-popup');
  var badge = $('#badge'), url = $('#url'), bingTab = $('.tab--bing'), bingTitle = $('#bing-tab-title');
  var tabs = $$('.tab');
  var tour = $('#tour'), steps = $$('.tour__step', tour), dots = $$('.tour__dots i', tour);
  var stage = $('#session-stage');
  var results = $('.serp__results');
  var boxHome = $('.sbox--home'), boxBar = $('.sbox--bar');
  var textHome = $('#sbox-home'), textBar = $('#sbox-bar');
  var bas = $('#bas'), basProg = $('#bas-prog'), basPct = $('#bas-pct'), basBar = $('#bas-bar'), basTime = $('#bas-time'), basStatus = $('#bas-status');
  var dtKeys = $('#dt-keys'), dtAvg = $('#dt-avg'), dtPauses = $('#dt-pauses'), dtTime = $('#dt-time'), dtLog = $('#dt-log');

  var vh = innerHeight;
  function layout() {
    vh = innerHeight;
    acts.forEach(function (el) {
      var r = el.getBoundingClientRect();
      byId[el.id].top = r.top + scrollY;
      byId[el.id].height = r.height;
    });
    measure();
  }
  function pinnedP(id) {
    var a = byId[id];
    return clamp01((scrollY - a.top) / Math.max(a.height - vh, 1));
  }

  // ------------------------------------------------------------- helpers
  var cache = {};
  function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
  function setAttr(el, key, name, v) { if (cache[key] !== v) { cache[key] = v; el.setAttribute(name, v); } }
  function toggle(el, key, cls, on) { if (cache[key] !== on) { cache[key] = on; el.classList.toggle(cls, on); } }

  function setBadge(text, color) {
    setText(badge, 'badge', text);
    toggle(badge, 'badge-on', 'is-on', text !== '');
    if (cache['badge-c'] !== color) { cache['badge-c'] = color; badge.style.background = color; }
  }

  // ---------------------------------------------------------------- hero
  function renderHero(p) {
    toggle(heroPopup, 'h-press', 'is-pressed', p > 0.36 && p < 0.5);
    toggle(heroPopup, 'h-run', 'is-running', p >= 0.46);
    var u = clamp01((p - 0.64) / 0.24);
    var key = u.toFixed(3);
    if (cache['h-fold'] !== key) {
      cache['h-fold'] = key;
      heroPopup.style.opacity = (1 - u).toFixed(3);
      heroPopup.style.transform = reduce ? 'none'
        : 'translate3d(' + (u * 14).toFixed(1) + 'px,' + (-u * 18).toFixed(1) + 'px,0) scale(' + (1 - 0.14 * u).toFixed(3) + ')';
      heroPopup.style.visibility = u >= 1 ? 'hidden' : 'visible';
    }
    var track = $('.popup__track i', heroPopup);
    if (track) track.style.transform = 'scaleX(' + (0.02 + 0.06 * clamp01((p - 0.46) / 0.2)).toFixed(3) + ')';
  }

  // ------------------------------------------------------------- session
  function typedCount(keys, T) {
    var n = 0;
    while (n < keys.length && keys[n].at <= T) n++;
    return n;
  }
  function sessionT(p) {
    var u;
    if (p < PH.type[1]) { u = p / PH.type[1]; return { phase: 'type', T: lerp(0, S.ty.end, u) }; }
    if (p < PH.load[1]) { u = (p - PH.load[0]) / (PH.load[1] - PH.load[0]); return { phase: 'load', T: lerp(S.ty.end, S.readStart, u) }; }
    if (p < PH.read[1]) { u = (p - PH.read[0]) / (PH.read[1] - PH.read[0]); return { phase: 'read', T: lerp(S.readStart, S.readEnd, u) }; }
    if (p < PH.wait[1]) { u = (p - PH.wait[0]) / (PH.wait[1] - PH.wait[0]); return { phase: 'wait', T: lerp(S.readEnd, S.waitEnd, u) }; }
    if (p < PH.ff[1]) { u = (p - PH.ff[0]) / (PH.ff[1] - PH.ff[0]); return { phase: 'ff', T: lerp(S.waitEnd, S.ffEnd, u) }; }
    u = (p - PH.brk[0]) / (PH.brk[1] - PH.brk[0]);
    return { phase: 'brk', T: lerp(S.ffEnd, S.ffEnd + Math.max(S.brkDur - 4, 1) * 1000, u) };
  }
  function readPos(T) {
    var pos = 0, prev = 0;
    for (var i = 0; i < S.reads.length; i++) {
      var r = S.reads[i];
      if (T < r.t) break;
      var target = clamp(prev + r.jump, 0, maxScroll);
      var k = reduce ? 1 : clamp01((T - r.t) / 450);
      k = 1 - Math.pow(1 - k, 3);
      pos = lerp(prev, target, k);
      prev = target;
    }
    return pos;
  }

  function renderSession(p, isCurrent) {
    if (!S) return;
    var st = sessionT(p), T = st.T, phase = st.phase;
    var q = S.q1, typed, status = 'searching', time = '•••', done = 0, searchN = 1, pos = 0, home = true, loading = false, query = q;

    if (phase === 'type') {
      typed = typedCount(S.ty.keys, T);
    } else {
      typed = S.ty.keys.length;
      home = T < S.loadAt;
      loading = T >= S.submitAt && T < S.loadAt;
    }
    var shownText = q.slice(0, typed);
    var typingBox = phase === 'type';

    if (phase === 'read') { status = 'reading'; pos = readPos(T); }
    if (phase === 'wait') {
      status = 'waiting'; done = 1; pos = readPos(S.readEnd);
      time = overlayLeft((S.waitEnd - T) / 1000);
    }
    if (phase === 'ff') {
      done = 1;
      var cur = null;
      for (var i = 0; i < S.ff.length; i++) if (T >= S.ff[i].start - 600) cur = S.ff[i];
      if (cur) {
        searchN = cur.n; query = cur.q;
        if (T < cur.typed) {
          status = 'searching'; done = cur.n - 1;
          shownText = cur.q.slice(0, typedCount(cur.sch.keys, T - cur.start));
          typingBox = true;
        } else if (T < cur.done) {
          status = 'searching'; done = cur.n - 1; shownText = cur.q;
          loading = T >= cur.sub;
        } else {
          status = 'waiting'; done = cur.n; shownText = cur.q;
          time = overlayLeft((cur.waitEnd - T) / 1000);
        }
      } else {
        status = 'waiting'; time = '0s'; pos = readPos(S.readEnd);
      }
    }
    if (phase === 'brk') {
      var last = S.ff.length ? S.ff[S.ff.length - 1] : null;
      query = last ? last.q : q; shownText = query; searchN = last ? last.n : 1; done = searchN;
      if (count > 5) {
        status = 'break';
        time = overlayLeft(S.brkDur - (T - S.ffEnd) / 1000);
      } else {
        status = 'complete'; time = '✓ Done';
      }
    }
    if (phase !== 'type') setResults(query);

    toggle(results, 'res', 'is-shown', p >= 0.262);

    // search boxes
    toggle(boxHome, 'bx-h', 'is-typing', home && typingBox);
    toggle(boxBar, 'bx-b', 'is-typing', !home && typingBox);
    setText(textHome, 'tx-h', home ? shownText : q);
    setText(textBar, 'tx-b', home ? '' : shownText);
    var y = Math.round(pos);
    if (cache['serp-y'] !== y) { cache['serp-y'] = y; serpList.style.transform = 'translate3d(0,' + (-y) + 'px,0)'; }

    // floating overlay (content.js renderOverlay)
    var pct = Math.round((done / count) * 100);
    setAttr(bas, 'bas-s', 'data-status', status);
    setText(basProg, 'bas-p', done + ' / ' + count + ' searches');
    setText(basPct, 'bas-pc', pct + '%');
    var bw = (done / count).toFixed(4);
    if (cache['bas-w'] !== bw) { cache['bas-w'] = bw; basBar.style.transform = 'scaleX(' + bw + ')'; }
    setText(basTime, 'bas-t', time);
    var label = { searching: 'Typing query', reading: 'Reading results', waiting: 'Next search in', break: 'Coffee break ☕', complete: 'Session complete' }[status];
    setText(basStatus, 'bas-st', label);

    // DevTools
    var keys = S.ty.keys, n = Math.min(typed, keys.length), sum = 0, pauses = 0;
    for (var j = 0; j < n; j++) { sum += keys[j].d; if (keys[j].think) pauses++; }
    setText(dtKeys, 'dt-k', n + ' / ' + keys.length);
    setText(dtAvg, 'dt-a', (n ? Math.round(sum / n) : 0) + ' ms');
    setText(dtPauses, 'dt-p', String(pauses));
    setText(dtTime, 'dt-t', (T / 1000).toFixed(1) + ' s');
    if (cache['dt-n'] !== n) {
      cache['dt-n'] = n;
      S.barEls.forEach(function (b, i) {
        b.classList.toggle('is-typed', i < n);
        b.classList.toggle('is-now', i === n - 1 && phase === 'type');
      });
    }
    var shown = 0;
    while (shown < S.log.length && S.log[shown].t <= T) shown++;
    if (S.shown !== shown) {
      S.shown = shown;
      dtLog.innerHTML = S.log.slice(Math.max(0, shown - 16), shown).map(function (e) {
        return '<li class="' + e.c + '"><span class="lg__t">+' + (e.t / 1000).toFixed(2) + ' s</span><span class="lg__k">' + escapeHtml(e.k) + '</span><span class="lg__v">' + escapeHtml(e.v) + '</span></li>';
      }).join('');
    }

    stage.setAttribute('data-sc-verify-state', [phase, n, y, time, shown, Math.round(T / 250)].join('|'));

    var title = home ? 'bing.com' : query + ' - Search';
    setText(bingTitle, 'bing-title', title);
    toggle(bingTab, 'bing-load', 'is-loading', loading);
    var badgeColor = status === 'break' ? '#eab308' : status === 'complete' ? '#10b981' : '#06b6d4';
    return {
      url: home ? 'bing.com' : 'bing.com/search?q=' + encodeURIComponent(query).replace(/%20/g, '+'),
      badge: [status === 'complete' ? '✓' : String(searchN), badgeColor],
      sub: p < 0.27 ? 'type' : p < PH.read[1] ? 'read' : p < PH.ff[1] ? 'pace' : 'break'
    };
  }

  // ------------------------------------------------------------- history
  function renderHistory() {
    var wrap = $('#hist-cards');
    if (!wrap) return;
    var m = lastModel || model(readSettings());
    var per = m.active + m.delay;
    var start = Date.now() - Math.min(count, 8) * per * 1000;
    wrap.innerHTML = queue.slice(0, 8).map(function (q, i) {
      var at = new Date(start + i * per * 1000);
      return '<article class="hcard"><p class="hcard__top"><span>' + timeFmt.format(at) + '</span><span>Search ' + (i + 1) + '</span></p>' +
        '<p class="hcard__q">' + escapeHtml(q) + '</p><p class="hcard__u">bing.com/search?q=' + escapeHtml(encodeURIComponent(q).replace(/%20/g, '+')) + '</p></article>';
    }).join('');
    $('#done-q').textContent = queue[Math.min(count, 8) - 1] || queue[0];
  }
  function renderGeo() {
    var name = geo;
    try { name = new Intl.DisplayNames(['en'], { type: 'region' }).of(geo) || geo; } catch (e) {}
    $('#geo').textContent = 'Your region: ' + name + '. Using the ' + (geo === 'IN' ? 'India' : 'global') + ' pool.';
    $('#geo-url').textContent = 'trends.google.com/trending/rss?geo=' + geo;
  }

  // ---------------------------------------------------------------- tour
  var ORDER = ['hero', 'work', 'type', 'read', 'pace', 'break', 'settings', 'history', 'install'];
  var DOT = { hero: 0, work: 1, type: 2, read: 2, pace: 2, break: 2, settings: 3, history: 4, install: 5 };
  var SUB_P = { type: 0.03, read: 0.33, pace: 0.53, break: 0.82 };
  function targetY(step) {
    var a;
    if (step === 'hero') return 0;
    if (step === 'work') { a = byId.work; return a.top - vh * 0.1; }
    if (SUB_P[step] != null) { a = byId.session; return a.top + (a.height - vh) * SUB_P[step]; }
    if (step === 'settings') { a = byId.settings; return a.top - vh * 0.1; }
    if (step === 'history') { a = byId.history; return a.top + 2; }
    a = byId.install; return a.top + (a.height - vh) * 0.6;
  }
  function go(step) {
    window.scrollTo({ top: Math.max(0, Math.round(targetY(step))), behavior: reduce ? 'auto' : 'smooth' });
  }
  var currentStep = 'hero';
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b) return;
    var g = b.getAttribute('data-go'), i = ORDER.indexOf(currentStep);
    if (g === 'next') go(ORDER[Math.min(i + 1, ORDER.length - 1)]);
    else if (g === 'back') go(ORDER[Math.max(i - 1, 0)]);
    else if (g === 'top') go('hero');
    else if (g === 'session') go('type');
  });
  function setStep(step) {
    if (step === currentStep && cache.step) return;
    var focused = document.activeElement && tour.contains(document.activeElement);
    currentStep = step; cache.step = true;
    tour.setAttribute('data-step', step);
    steps.forEach(function (s) { s.classList.toggle('is-on', s.getAttribute('data-step') === step); });
    var d = DOT[step];
    dots.forEach(function (el, i) { el.classList.toggle('is-on', i === d); el.classList.toggle('is-done', i < d); });
    if (focused) {
      var nb = $('.tour__step.is-on [data-go="next"]', tour) || $('.tour__step.is-on button', tour);
      if (nb) nb.focus({ preventScroll: true });
    }
  }

  // --------------------------------------------------------------- frame
  var URLS = {
    newtab: 'chrome://newtab',
    work: 'notes.example.com/thursday-plan',
    settings: 'chrome-extension://gldhjncdmgpileambimhpjmeoejgclen/options/options.html',
    history: 'chrome://history/?q=bing.com'
  };
  function currentAct() {
    var line = scrollY + vh * 0.45, cur = acts[0].id;
    for (var i = 0; i < acts.length; i++) if (byId[acts[i].id].top <= line) cur = acts[i].id;
    return cur;
  }
  function frame() {
    var act = currentAct();
    var heroP = pinnedP('newtab');
    renderHero(heroP);
    var bingOpen = heroP >= 0.58 || act !== 'newtab';
    toggle(document.body, 'bing-open', 'is-bing-open', bingOpen);

    var sp = pinnedP('session');
    var sess = renderSession(sp, act === 'session');

    var tabKey = act === 'install' || act === 'session' ? 'session' : act;
    if (cache.tab !== tabKey) {
      cache.tab = tabKey;
      tabs.forEach(function (t) {
        if (t.getAttribute('data-tab') === tabKey) t.setAttribute('aria-current', 'page');
        else t.removeAttribute('aria-current');
      });
    }

    var u, step;
    if (act === 'session') { u = sess.url; step = sess.sub; setBadge(sess.badge[0], sess.badge[1]); }
    else if (act === 'install') { u = 'bing.com/search?q=' + encodeURIComponent($('#done-q').textContent).replace(/%20/g, '+'); step = 'install'; setBadge('✓', '#10b981'); }
    else {
      u = URLS[act]; step = act === 'newtab' ? 'hero' : act;
      if (act === 'newtab') setBadge(bingOpen ? '0' : '', '#06b6d4');
      else if (act === 'work') setBadge('1', '#06b6d4');
      else setBadge(String(Math.min(count, 6)), '#06b6d4');
    }
    setText(url, 'url', u);
    setStep(step);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; frame(); });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', function () { layout(); frame(); }, { passive: true });

  // the clock on the new tab is the visitor's own
  function tickClock() { $('#nt-time').textContent = clockText(new Date()); }
  tickClock();
  setInterval(tickClock, 15000);

  // ------------------------------------------------------------------ boot
  renderGeo();
  forecast();
  buildSession();
  renderHistory();
  layout();
  frame();

  fetch(geo === 'IN' ? '/data/queries.json' : '/data/queries-global.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (list) {
      if (!Array.isArray(list) || !list.length) return;
      pool = list;
      var chars = 0, spaces = 0;
      list.forEach(function (q) { chars += q.length; spaces += (q.match(/ /g) || []).length; });
      poolStats = { avgLen: chars / list.length, spaceFrac: spaces / Math.max(chars, 1) };
      var untouched = scrollY < byId.session.top - vh * 0.5;
      queue = pickQueue(pool);
      if (untouched) buildSession();
      forecast();
      renderHistory();
      layout();
      frame();
    })
    .catch(function () {});

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); frame(); });
  addEventListener('load', function () { sc.layout(); layout(); frame(); });
})();
