/* sim.js — the Battle Simulator page toys.
   Registers with common.js via window.BH.registerPage: the bear-ratio
   calculator. Given a rally lead's attack and lethality per troop type (from
   the lead's report), it works out the ideal troop mix (f_t proportional to
   the squared weight, MATHS.md §4) and the leader strength K (§5). Strings are
   read lazily from the active dictionary (sim.* keys, English fallback) and the
   page re-paints on i18n:change, so a language switch mid-session shows the new
   language and locale-formatted numbers. Heroes are deliberately out of this
   first version — only the lead's A factors matter for the ratio. */
(function () {
  'use strict';

  // ── The three troop types ─────────────────────────────
  // key = internal; nameKey/fallback = the type's translated label; pre/ple =
  // the input ids for that type's attack / lethality.
  var TYPES = [
    { key: 'inf', nameKey: 'sim.calc.inf', fallback: 'Infantry', pre: 'sim-atk-inf', ple: 'sim-let-inf' },
    { key: 'cav', nameKey: 'sim.calc.cav', fallback: 'Cavalry',  pre: 'sim-atk-cav', ple: 'sim-let-cav' },
    { key: 'arc', nameKey: 'sim.calc.arc', fallback: 'Archery',  pre: 'sim-atk-arc', ple: 'sim-let-arc' }
  ];

  function num(id) {
    var el = document.getElementById(id);
    var v = parseFloat(el ? el.value : '');
    return isFinite(v) ? v : 0;
  }

  function locale() {
    return (window.I18N && window.I18N.locale) || 'en-GB';
  }

  // A percentage with one decimal, in the active locale's digits.
  function pct(x) {
    try {
      return x.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    } catch (e) {
      return x.toFixed(1) + '%';
    }
  }

  // A plain number at a fixed precision, locale digits.
  function numFmt(x, digits) {
    try {
      return x.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch (e) {
      return x.toFixed(digits);
    }
  }

  // ── The maths (MATHS.md §4–5) ─────────────────────────
  // A_t = (1 + attack/100)(1 + lethality/100)
  // w = (A_inf/3, A_cav, 4.4·A_arc/3)
  // f_t ∝ w_t²   (normalised)     K = √(Σ w_t²)
  function compute() {
    var A = {}, w = {}, share = {}, sum = 0;
    TYPES.forEach(function (t) {
      A[t.key] = (1 + num(t.pre) / 100) * (1 + num(t.ple) / 100);
    });
    w.inf = A.inf / 3;
    w.cav = A.cav;
    w.arc = (4.4 * A.arc) / 3;
    sum = w.inf * w.inf + w.cav * w.cav + w.arc * w.arc;
    if (sum > 0) {
      share.inf = (w.inf * w.inf) / sum;
      share.cav = (w.cav * w.cav) / sum;
      share.arc = (w.arc * w.arc) / sum;
    } else {
      share.inf = share.cav = share.arc = 0;
    }
    return { A: A, w: w, share: share, k: Math.sqrt(sum), ok: sum > 0 };
  }

  function paint(BH) {
    var s = compute();

    var headline = document.getElementById('sim-headline');
    if (headline) {
      if (!s.ok) {
        headline.innerHTML = BH.tr('sim.calc.noStats',
          'Enter the lead\u2019s <b>attack</b> and <b>lethality</b> — the ratio comes from their stats.');
      } else {
        headline.innerHTML = BH.tr('sim.calc.headline',
          'With this lead, the ideal march is <b>{inf}</b> infantry, <b>{cav}</b> cavalry, <b>{arc}</b> archers.')
          .replace(/\{inf\}/g, pct(s.share.inf * 100))
          .replace(/\{cav\}/g, pct(s.share.cav * 100))
          .replace(/\{arc\}/g, pct(s.share.arc * 100));
      }
    }

    var out = document.getElementById('sim-out');
    if (out) {
      var html = '';
      if (s.ok) {
        html = '<div class="sim-head">' +
          '<span>' + BH.tr('sim.calc.thType', 'Troop') + '</span>' +
          '<span>' + BH.tr('sim.calc.thA', 'A factor') + '</span>' +
          '<span>' + BH.tr('sim.calc.thWeight', 'weight') + '</span>' +
          '<span>' + BH.tr('sim.calc.thShare', 'ideal share') + '</span></div>';
        TYPES.forEach(function (t) {
          html += '<div class="sim-row">' +
            '<span class="sim-type">' + BH.tr(t.nameKey, t.fallback) + '</span>' +
            '<span class="sim-a">' + numFmt(s.A[t.key], 2) + '\u00D7</span>' +
            '<span class="sim-w">' + numFmt(s.w[t.key], 2) + '</span>' +
            '<span class="sim-share">' + pct(s.share[t.key] * 100) + '</span></div>';
        });
      }
      out.innerHTML = html;
      out.hidden = html === '';
    }

    var kEl = document.getElementById('sim-k');
    if (kEl) {
      kEl.innerHTML = s.ok
        ? BH.tr('sim.calc.k', 'Leader strength K = <b>{k}</b>').replace(/\{k\}/g, numFmt(s.k, 2))
        : '';
    }
  }

  function boot(BH) {
    TYPES.forEach(function (t) {
      [t.pre, t.ple].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', function () { paint(BH); });
      });
    });
    wireOcr(BH);
    paint(BH);
    warmOcr();
  }

  // Start the engine download and session build once the page is idle, so the
  // first OCR click doesn't stall on ~9 MB of models + wasm. loadPaddle()
  // caches its promise: a click during warm-up awaits the same promise (no
  // double download), a click after it runs predict only. Skipped on
  // data-saver / 2G connections — those readers still get OCR, it just pays
  // the download on the click instead of up front.
  function warmOcr() {
    var conn = navigator.connection;
    if (conn && (conn.saveData || /2g/i.test(conn.effectiveType || ''))) return;
    var warm = function () { loadPaddle().catch(function () {}); };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(warm, { timeout: 4000 });
    } else {
      setTimeout(warm, 2000);
    }
  }

  // ── OCR prefill — read a battle-report screenshot, fill the form ──
  // The whole pipeline runs client-side (static site, no server): PaddleOCR.js
  // (PP-OCRv6 tiny) reads the raw screenshot — no crop, no upscaling — and each
  // recognised word carries a box, so the 12 Bonus Details values are mapped
  // by their row label (block + stat) and column (left = your green value).
  // The engine module comes from jsdelivr (ESM, no bundler needed); the ~6 MB
  // model pair is self-hosted at /models/ because the upstream Baidu bucket
  // sends broken CORS headers. boot() warms the engine once the page is idle
  // (warmOcr), so the first click runs predict only; loadPaddle caches its
  // promise, so a click during warm-up shares the same in-flight load. The
  // form stays the source of truth — this is a prefill, and every value is
  // editable.
  var PADDLE_ESM = 'https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm';
  var PADDLE_MODELS = {
    textDetectionModelName: 'PP-OCRv6_tiny_det',
    textRecognitionModelName: 'PP-OCRv6_tiny_rec',
    textDetectionModelAsset: { url: modelsUrl('det-v6-tiny.tar') },
    textRecognitionModelAsset: { url: modelsUrl('rec-v6-tiny.tar') }
  };
  var paddlePromise = null;

  // Resolve the site-root /models/ dir from this file's own URL (same trick as
  // i18n.js), so the model fetch works from any page depth.
  function modelsUrl(file) {
    var s = document.currentScript;
    var src = s && s.src;
    if (!src) {
      var tags = document.getElementsByTagName('script');
      for (var i = 0; i < tags.length; i++) {
        if ((tags[i].src || '').indexOf('sim.js') !== -1) { src = tags[i].src; break; }
      }
    }
    var base = src ? src.replace(/\/js\/sim\.js[^/]*$/, '/') : '';
    return base + 'models/' + file;
  }

  function ocrStatus(BH, key, fb, cls) {
    var el = document.getElementById('sim-ocr-status');
    if (!el) return;
    if (!key) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = BH.tr(key, fb);
    el.className = 'sim-ocr-status' + (cls ? ' ' + cls : '');
  }

  function loadPaddle() {
    if (!paddlePromise) {
      paddlePromise = import(PADDLE_ESM)
        .then(function (m) {
          return m.PaddleOCR.create(Object.assign({ worker: false }, PADDLE_MODELS));
        });
    }
    return paddlePromise;
  }

  // Group recognised words into visual rows (by box y), then for each row that
  // carries a "Block Stat" label take the leftmost percentage — the green
  // column, your own stat. Returns { 'Block|Stat': value }.
  function parseItems(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it || !it.text) return;
      var text = String(it.text).trim();
      if (!text || !it.poly) return;
      var ys = it.poly.map(function (p) { return p[1]; });
      var xs = it.poly.map(function (p) { return p[0]; });
      var cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
      var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        if (Math.abs(rows[i].cy - cy) < 14) { row = rows[i]; break; }
      }
      if (!row) { row = { cy: cy, items: [] }; rows.push(row); }
      row.items.push({ cx: cx, text: text });
    });
    var out = {};
    rows.forEach(function (r) {
      r.items.sort(function (a, b) { return a.cx - b.cx; });
      var joined = '';
      r.items.forEach(function (it) { joined += ' ' + it.text; });
      var lm = joined.match(/(Infantry|Cavalry|Archer)\s+(Attack|Defense|Lethality|Health)/);
      if (!lm) return;
      var label = lm[1] + '|' + lm[2];
      if (label in out) return; // first (topmost) row wins
      for (var j = 0; j < r.items.length; j++) {
        var pm = r.items[j].text.match(/^[+\-]?(\d+(?:\.\d+)?)%$/);
        if (pm) { out[label] = parseFloat(pm[1]); break; }
      }
    });
    return out;
  }

  function fill(vals, BH) {
    var map = [
      ['Infantry|Attack', 'sim-atk-inf'],
      ['Infantry|Lethality', 'sim-let-inf'],
      ['Cavalry|Attack', 'sim-atk-cav'],
      ['Cavalry|Lethality', 'sim-let-cav'],
      ['Archer|Attack', 'sim-atk-arc'],
      ['Archer|Lethality', 'sim-let-arc']
    ];
    var filled = 0;
    map.forEach(function (m) {
      var el = document.getElementById(m[1]);
      var v = vals[m[0]];
      if (el && v !== undefined && isFinite(v)) {
        el.value = String(Math.round(v * 10) / 10);
        el.dispatchEvent(new Event('input'));
        filled++;
      }
    });
    return filled;
  }

  var ocrBusy = false;
  function wireOcr(BH) {
    var btn = document.getElementById('sim-ocr-btn');
    var file = document.getElementById('sim-ocr-file');
    if (!btn || !file) return;
    btn.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f || ocrBusy) return;
      ocrBusy = true;
      ocrStatus(BH, 'sim.ocr.loading', 'Reading the screenshot\u2026');
      loadPaddle()
        .then(function (ocr) { return ocr.predict(f); })
        .then(function (res) {
          var items = res && res[0] && res[0].items ? res[0].items : [];
          var filled = fill(parseItems(items), BH);
          if (filled >= 6) ocrStatus(BH, 'sim.ocr.done', 'Filled from your report \u2014 double-check the numbers.', 'ok');
          else ocrStatus(BH, 'sim.ocr.fail', 'Couldn\u2019t read that screenshot. Try a clearer shot, or enter the numbers below.', 'bad');
        })
        .catch(function () {
          ocrStatus(BH, 'sim.ocr.fail', 'Couldn\u2019t read that screenshot. Try a clearer shot, or enter the numbers below.', 'bad');
        })
        .then(function () { ocrBusy = false; });
    });
  }

  BH.registerPage({
    boot: boot,
    onChange: function () { paint(BH); }
  });
})();
