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
  // first OCR click doesn't stall on ~6 MB of models + the wasm session. All of
  // that happens in the worker, so warming costs the page thread nothing; the
  // worker keeps the engine, so a click during warm-up waits on the same one
  // (no double download) and a click after it runs predict only. Skipped on
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
  // The whole pipeline runs client-side (static site, no server). The engine
  // itself lives in js/ocr-worker.js: PaddleOCR.js (PP-OCRv6 tiny) plus ONNX
  // Runtime and OpenCV are megabytes of JS and a wasm session compile, and
  // running them here froze the page for seconds mid-read. This side only
  // posts the picked file and parses what comes back — each recognised word
  // carries a box, so the 12 Bonus Details values are mapped by their row label
  // (block + stat) and column (left = your green value). boot() warms the
  // engine once the page is idle (warmOcr) so the first click doesn't also pay
  // the download. The form stays the source of truth — this is a prefill, and
  // every value is editable.

  // Site root from this file's own URL (same trick as i18n.js), so the worker
  // path resolves from any page depth.
  function scriptBase() {
    var s = document.currentScript;
    var src = s && s.src;
    if (!src) {
      var tags = document.getElementsByTagName('script');
      for (var i = 0; i < tags.length; i++) {
        if ((tags[i].src || '').indexOf('js/sim.js') !== -1) { src = tags[i].src; break; }
      }
    }
    return src ? src.replace(/js\/sim\.js[^/]*$/, '') : '';
  }

  var worker = null, seq = 0, pending = {};

  function failPending(err) {
    var p = pending;
    pending = {};
    Object.keys(p).forEach(function (id) { p[id].reject(err); });
  }

  function ocrWorker() {
    if (worker) return worker;
    worker = new Worker(scriptBase() + 'js/ocr-worker.js', { type: 'module' });
    worker.onmessage = function (e) {
      var m = e.data || {}, p = pending[m.id];
      if (!p) return;
      delete pending[m.id];
      if (m.ok) p.resolve(m); else p.reject(new Error(m.error || 'ocr failed'));
    };
    // A crashed or unloadable worker would otherwise leave every click waiting
    // forever; reject what's in flight, drop it, and rebuild on the next try.
    var dead = function (err) {
      failPending(err);
      try { worker.terminate(); } catch (e) { /* already gone */ }
      worker = null;
    };
    worker.onerror = function (e) { dead(new Error((e && e.message) || 'ocr worker error')); };
    worker.onmessageerror = function () { dead(new Error('ocr worker message error')); };
    return worker;
  }

  // One request, one reply, matched by id. 'warm' builds the engine; 'predict'
  // implies it.
  function askWorker(type, blob) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      try {
        ocrWorker().postMessage({ id: id, type: type, blob: blob });
      } catch (e) {
        delete pending[id];
        worker = null;
        reject(e);
      }
    });
  }

  function loadPaddle() {
    return askWorker('warm').then(function () { return true; });
  }

  function ocrStatus(BH, key, fb, cls, vars) {
    var el = document.getElementById('sim-ocr-status');
    if (!el) return;
    if (!key) { el.hidden = true; el.textContent = ''; return; }
    var text = BH.tr(key, fb);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'sim-ocr-status' + (cls ? ' ' + cls : '');
  }

  // ── Reading the panel ─────────────────────────────────
  var BLOCKS = ['Infantry', 'Cavalry', 'Archer'];
  var STATS = ['Attack', 'Defense', 'Lethality', 'Health'];

  // OCR misreads a letter here and there ("lnfantry", "Letha1ity"), and often
  // returns a whole row label as one box ("Infantry Attack") rather than two.
  // Fold the usual digit/letter lookalikes and keep the spaces: both the row and
  // the wanted words go through the same fold, so exact matches stay exact.
  function fold(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
      .replace(/[1li]/g, 'i').replace(/0/g, 'o').replace(/5/g, 's')
      .replace(/\s+/g, ' ').trim();
  }

  function withinOneEdit(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  // Which of `list`'s words this (already folded) row carries: as a run of text
  // anywhere in the row, or as a single misspelt token.
  function wordIn(folded, list) {
    var i, j;
    for (i = 0; i < list.length; i++) if (folded.indexOf(fold(list[i])) !== -1) return list[i];
    var tokens = folded.split(' ');
    for (i = 0; i < tokens.length; i++) {
      if (tokens[i].length < 5) continue;
      for (j = 0; j < list.length; j++) {
        if (withinOneEdit(tokens[i], fold(list[j]))) return list[j];
      }
    }
    return null;
  }

  // The panel row's own height sets the row tolerance: a fixed pixel figure is
  // wrong the moment the screenshot isn't the size it was tuned on.
  function rowTolerance(boxes) {
    if (!boxes.length) return 8;
    var hs = boxes.map(function (b) { return b.h; }).sort(function (a, b) { return a - b; });
    return Math.max(8, hs[Math.floor(hs.length / 2)] * 0.55);
  }

  // Group recognised words into visual rows, then read the left (your) column of
  // every troop-type stat row. Returns { 'Block|Stat': value }.
  function parseItems(items) {
    var boxes = [];
    items.forEach(function (it) {
      if (!it || !it.text || !it.poly) return;
      var text = String(it.text).trim();
      if (!text) return;
      var xs = it.poly.map(function (p) { return p[0]; });
      var ys = it.poly.map(function (p) { return p[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      boxes.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, h: y1 - y0, text: text });
    });

    var tol = rowTolerance(boxes);
    boxes.sort(function (a, b) { return a.cy - b.cy; });
    var rows = [];
    boxes.forEach(function (b) {
      var row = rows.length ? rows[rows.length - 1] : null;
      if (row && Math.abs(b.cy - row.cy) <= tol) {
        row.items.push(b);
        row.cy = (row.cy * (row.items.length - 1) + b.cy) / row.items.length;
      } else {
        rows.push({ cy: b.cy, items: [b] });
      }
    });

    var out = {};
    rows.forEach(function (r) {
      r.items.sort(function (a, b) { return a.cx - b.cx; });
      var joined = r.items.map(function (b) { return b.text; }).join(' ');
      var folded = fold(joined);
      var block = wordIn(folded, BLOCKS);
      var stat = wordIn(folded, STATS);
      if (!block || !stat) return;
      var label = block + '|' + stat;
      if (label in out) return; // first (topmost) row wins
      // The green (your) column sits left of the label and the red one right of
      // it, so the value we want is the last percentage *before* the label —
      // that survives the OCR fusing two numbers into one box. Joining the row
      // first also survives it splitting "+457.5" and "%" apart.
      var at = joined.search(new RegExp(block, 'i'));
      var m = null;
      if (at === -1) {
        m = joined.match(/[+\-]?\d+(?:\.\d+)?\s*%/);
      } else {
        var pct = /[+\-]?\d+(?:\.\d+)?\s*%/g, hit;
        while ((hit = pct.exec(joined)) !== null) {
          if (hit.index >= at) break;
          m = hit;
        }
        if (!m) m = joined.match(/[+\-]?\d+(?:\.\d+)?\s*%/);
      }
      if (!m) return;
      var v = parseFloat(m[0]);
      if (isFinite(v)) out[label] = v;
    });
    return out;
  }

  // The ratio needs only attack and lethality; the panel's Defense/Health rows
  // are parsed (future modes want them) but not filled.
  var FIELDS = [
    ['Infantry|Attack', 'sim-atk-inf'],
    ['Infantry|Lethality', 'sim-let-inf'],
    ['Cavalry|Attack', 'sim-atk-cav'],
    ['Cavalry|Lethality', 'sim-let-cav'],
    ['Archer|Attack', 'sim-atk-arc'],
    ['Archer|Lethality', 'sim-let-arc']
  ];

  // Set every value we read and let the caller repaint once. Dispatching an
  // `input` event per field repainted the whole panel six times for one import
  // (six style/layout invalidations for ~1.5 ms of work that costs ~0.25 ms).
  function fill(vals) {
    var filled = 0;
    FIELDS.forEach(function (f) {
      var el = document.getElementById(f[1]);
      var v = vals[f[0]];
      if (el && v !== undefined && isFinite(v)) {
        el.value = String(Math.round(v * 10) / 10);
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
      // Clear the picker so choosing the same screenshot twice still fires.
      file.value = '';
      if (!f || ocrBusy) return;
      ocrBusy = true;
      ocrStatus(BH, 'sim.ocr.loading', 'Reading the screenshot\u2026');
      loadPaddle()
        .then(function () { return askWorker('predict', f); })
        .then(function (res) {
          var filled = fill(parseItems(res.items));
          if (filled) paint(BH);
          if (filled === FIELDS.length) {
            ocrStatus(BH, 'sim.ocr.done', 'Filled from your report \u2014 double-check the numbers.', 'ok');
          } else if (filled > 0) {
            // A partial read is still useful: keep what we got and say so,
            // rather than discarding it behind a flat "couldn't read that".
            // Amber like a full read — values landed; the count is the caveat.
            ocrStatus(BH, 'sim.ocr.partial',
              'Read {n} of 6 values \u2014 fill in the rest below.', 'ok', { n: filled });
          } else {
            ocrStatus(BH, 'sim.ocr.fail', 'Couldn\u2019t read that screenshot. Try a clearer shot, or enter the numbers below.', 'bad');
          }
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
