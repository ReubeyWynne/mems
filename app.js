/* Bear Hunt, Demystified — tiny vanilla enhancements.
   The page is fully readable without this file; it only adds
   a scroll progress bar, section highlighting, the cracktro
   depth pull (front layer), and the two calculators.
   No dependencies, no data collected.
   i18n: all user-visible strings come from i18n/<lang>.js via
   window.I18N; numbers format per the active locale. */
(function () {
  'use strict';

  function getLocale() {
    return (window.I18N && window.I18N.locale) || 'en-GB';
  }
  function tr(key, fallback) {
    return (window.I18N && window.I18N.tr) ? window.I18N.tr(key, fallback) : fallback;
  }

  var nf = new Intl.NumberFormat(getLocale());

  function boot() {
    // ── Scroll progress bar ────────────────────────────────
    var fill = document.getElementById('progress');
    var doc = document.documentElement;
    function paintProgress() {
      if (!fill) return;
      var max = doc.scrollHeight - doc.clientHeight;
      fill.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', paintProgress, { passive: true });
    paintProgress();

    // ── TOC active section ─────────────────────────────────
    var toc = document.getElementById('toc');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
    var sections = tocLinks
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);

    // Keep the active link visible: scroll the rail horizontally
    // so the current section's label never runs off either edge.
    function revealActive() {
      if (!toc) return;
      var active = toc.querySelector('a.active');
      if (!active) return;
      var r = toc.getBoundingClientRect();
      var a = active.getBoundingClientRect();
      if (a.left < r.left || a.right > r.right) {
        // Direction-aware centering: rect deltas are sign-consistent
        // with scrollLeft in both LTR and RTL (Chrome RTL is negative).
        var rtl = document.documentElement.dir === 'rtl';
        var delta = rtl ? (a.right - r.right) : (a.left - r.left);
        var target = toc.scrollLeft + (rtl ? -delta : delta) - (toc.clientWidth - active.offsetWidth) / 2;
        toc.scrollTo({ left: target, behavior: 'smooth' });
      }
    }

    // Desktop: wheel over the rail scrolls it horizontally.
    if (toc) {
      toc.addEventListener('wheel', function (e) {
        if (toc.scrollWidth > toc.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          toc.scrollLeft += (document.documentElement.dir === 'rtl' ? -1 : 1) * e.deltaY;
        }
      }, { passive: false });
    }

    if ('IntersectionObserver' in window && tocLinks.length && sections.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.id;
            tocLinks.forEach(function (a) {
              a.classList.toggle('active', a.getAttribute('href') === '#' + id);
            });
            revealActive();
          }
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      sections.forEach(function (s) { io.observe(s); });
    }

    // ── Cracktro depth pull ────────────────────────────────
    // The section at the read position is the FRONT layer:
    // it alone gets the caret and full brightness; everything
    // else sits back in the stack. Same observer geometry as
    // the TOC, so the front layer is always the active section.
    var contentSections = Array.prototype.slice.call(document.querySelectorAll('main .section'));
    if ('IntersectionObserver' in window && contentSections.length) {
      var front = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            contentSections.forEach(function (s) { s.classList.remove('front'); });
            entry.target.classList.add('front');
            maybeWhisper(entry.target.id);
          }
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      contentSections.forEach(function (s) { front.observe(s); });
      // The hero starts as the front layer before any scroll.
      var hero = document.querySelector('main .hero');
      if (hero) hero.classList.add('front');
    }

    // ── Number formatting helpers ───────────────────────────
    function fmt(n) {
      if (!isFinite(n)) return '\u2014';
      return nf.format(Math.round(n));
    }
    function mult(n) {
      return n.toLocaleString(getLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 0 }) + '\u00D7';
    }

    // ── Rally-fill calculator ──────────────────────────────
    // Elements are re-queried on every paint: the i18n loader
    // replaces innerHTML on the output rows, so stale references
    // must never be trusted.
    function paintRally() {
      var rCap = document.getElementById('rally-cap');
      var rPlayers = document.getElementById('rally-players');
      if (!rCap || !rPlayers) return;
      var T = Math.max(1, parseInt(rCap.value, 10) || 0);
      var j = Math.min(15, Math.max(1, parseInt(rPlayers.value, 10) || 1));
      var pOut = document.getElementById('rally-p-out');
      var share = document.getElementById('rally-share');
      var rMult = document.getElementById('rally-mult');
      if (pOut) pOut.textContent = j;
      if (share) share.textContent = fmt(T / j);
      if (rMult) rMult.textContent = mult(Math.sqrt(j));
    }
    var rCap = document.getElementById('rally-cap');
    var rPlayers = document.getElementById('rally-players');
    if (rCap) rCap.addEventListener('input', paintRally);
    if (rPlayers) rPlayers.addEventListener('input', paintRally);
    paintRally();

    // ── March-split calculator ─────────────────────────────
    function paintMarch() {
      var mPool = document.getElementById('march-pool');
      var mQ = document.getElementById('march-q');
      if (!mPool || !mQ) return;
      var P = Math.max(1, parseInt(mPool.value, 10) || 0);
      var q = Math.min(6, Math.max(1, parseInt(mQ.value, 10) || 1));
      var qOut = document.getElementById('march-q-out');
      var share = document.getElementById('march-share');
      var mMult = document.getElementById('march-mult');
      if (qOut) qOut.textContent = q;
      if (share) share.textContent = fmt(P / q);
      if (mMult) mMult.textContent = mult(Math.sqrt(q));
    }
    var mPool = document.getElementById('march-pool');
    var mQ = document.getElementById('march-q');
    if (mPool) mPool.addEventListener('input', paintMarch);
    if (mQ) mQ.addEventListener('input', paintMarch);
    paintMarch();

    // ── Easter eggs — the bear keeps notes ────────────────
    // One integer in localStorage, bit N = egg N seen. Crafted
    // eggs are one-shot discoveries; the gossip pool repeats.
    // Nothing else is ever written.
    var EGG_KEY = 'bh_eggs';
    var seen = 0;
    try { seen = parseInt(localStorage.getItem(EGG_KEY) || '0', 10) || 0; } catch (e) { /* private mode */ }
    function eggSeen(id) { return (seen & (1 << id)) !== 0; }
    function markEgg(id) {
      seen = seen | (1 << id);
      try { localStorage.setItem(EGG_KEY, String(seen)); } catch (e) { /* private mode */ }
    }

    // A single parchment slip, reused. Floating for whispers and
    // toasts; static (anchored inside a .calc) for calculator eggs.
    var note = null;
    function showNote(line, anchor) {
      if (note && note.parentNode) note.parentNode.removeChild(note);
      var el = document.createElement('div');
      note = el;
      el.className = 'egg-note' + (anchor ? ' calc-note' : '');
      el.style.setProperty('--tilt', (Math.random() * 5 - 2.5).toFixed(2) + 'deg');
      el.setAttribute('aria-hidden', 'true');
      el.textContent = line;
      if (anchor) {
        anchor.appendChild(el);
      } else {
        var left = Math.random() < 0.5;
        el.style.left = left ? (6 + Math.random() * 14) + 'vw' : 'auto';
        el.style.right = left ? 'auto' : (6 + Math.random() * 14) + 'vw';
        el.style.bottom = (16 + Math.random() * 34) + 'vh';
        document.body.appendChild(el);
      }
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, anchor ? 6800 : 7400);
    }

    // ── Random margin whispers & alliance gossip ───────────
    // `whispers` are one-shot discoveries (bit N set once).
    // `gossip` is repeatable alliance lore — no bit, it can
    // recur like alliance chat, rate-limited and capped.
    // Strings come from the active dictionary; rebuilt on
    // language change so new toasts appear translated.
    var whispers = [];
    var gossip = [];
    function refreshEggStrings() {
      whispers = [
        { id: 0,  section: 'top',     line: tr('egg.whisper0', 'the bear reads this page too. he\u2019s taking notes.') },
        { id: 1,  section: 'sqrt',    line: tr('egg.whisper1', 'the \u221A is the bear\u2019s favourite sign') },
        { id: 2,  section: 'rally',   line: tr('egg.whisper2', 'a full rally is fifteen players at once. the bear still can\u2019t feel it.') },
        { id: 3,  section: 'marches', line: tr('egg.whisper3', 'six marches, six fires. the bear watches them. he\u2019s watching yours.') },
        { id: 4,  section: 'timing',  line: tr('egg.whisper4', 'i see you greeding r3lax\u2019s rally') },
        { id: 5,  section: 'mix',     line: tr('egg.whisper5', '10/10/80. arrows hurt, who knew?') },
        { id: 6,  section: 'rewards', line: tr('egg.whisper6', 'we asked the bear for a 19th hammer. century games are watching us now...') },
        { id: 7,  section: 'rules',   line: tr('egg.whisper7', 'rule five is whispered, never written.') }
      ];
      gossip = [
        tr('egg.gossip0', 'xglitchx is a dinosaur 🦖'),
        tr('egg.gossip1', 'xglitchx is a furry 🐾'),
        tr('egg.gossip2', 'get in the basement 🕳️'),
        tr('egg.gossip3', 'Spooks for King! 👑'),
        tr('egg.gossip4', 'take a second to r3lax 😌'),
        tr('egg.gossip5', 'lucy\u2019s archers scare me 🏹'),
        tr('egg.gossip6', 'shadow you have how many troops?!? ⚔️'),
        tr('egg.gossip7', 'you saving for KvK? 💎')
      ];
    }
    refreshEggStrings();

    var lastNoteAt = 0;
    var notesShown = 0;
    function maybeWhisper(sectionId) {
      if (notesShown >= 5 || !sectionId) return;
      var now = Date.now();
      if (now - lastNoteAt < 8000) return;
      var w = null;
      for (var i = 0; i < whispers.length; i++) {
        if (whispers[i].section === sectionId && !eggSeen(whispers[i].id)) { w = whispers[i]; break; }
      }
      var line = null;
      if (w && Math.random() < 0.03) {
        markEgg(w.id);
        line = w.line;
      } else if (Math.random() < 0.05) {
        line = gossip[Math.floor(Math.random() * gossip.length)];
      }
      if (!line) return;
      notesShown += 1;
      lastNoteAt = now;
      showNote(line);
    }

    // ── Calculator-state eggs (deliberate deviations only) ─
    // The toast line is read from the dictionary at fire time so
    // a language switch mid-session still shows the right text.
    function armCalcEgg(input, match, eggId, key, fallback, anchor) {
      if (!input) return;
      input.addEventListener('input', function () {
        if (eggSeen(eggId)) return;
        var v = parseInt(input.value, 10);
        if (match(v)) {
          markEgg(eggId);
          showNote(tr(key, fallback), anchor);
        }
      });
    }
    armCalcEgg(rPlayers, function (v) { return v === 1; }, 8,
      'egg.calc1', 'a lonely rally. the bear approves.', rPlayers ? rPlayers.closest('.calc') : null);
    armCalcEgg(rCap, function (v) { return v === 1000000; }, 9,
      'egg.calc2', 'a 1M rally. the bear salutes. (it has no hands.)', rCap ? rCap.closest('.calc') : null);
    armCalcEgg(mQ, function (v) { return v === 1; }, 10,
      'egg.calc3', 'one march, one \u221A. a single clean line.', mQ ? mQ.closest('.calc') : null);
    armCalcEgg(mPool, function (v) { return v === 1600000; }, 11,
      'egg.calc4', '16\u00D7 troops, only 4.0\u00D7 damage. the bear saw you do the maths.', mPool ? mPool.closest('.calc') : null);

    // ── The hedera — click it seven times ─────────────────
    var hedera = document.getElementById('hedera');
    if (hedera) {
      var taps = 0;
      var hederaTap = function () {
        taps += 1;
        hedera.classList.add('tapped');
        setTimeout(function () { hedera.classList.remove('tapped'); }, 200);
        if (taps >= 7) {
          taps = -99;
          if (!eggSeen(12)) {
            markEgg(12);
            var ruleFive = document.getElementById('rulefive');
            if (ruleFive) ruleFive.hidden = false;
            showNote(tr('egg.hedera', 'seven clicks. the scribe counted too.'));
          }
        }
      };
      hedera.addEventListener('click', hederaTap);
      hedera.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hederaTap(); }
      });
    }

    // ── Typed words — parchment toasts ─────────────────────
    // The secret words stay English in every language (typing
    // is Latin-only by design); the toasts translate.
    var typedBuf = '';
    var secretWords = [
      { id: 13, word: 'frak',    key: 'egg.word.frak',    fallback: 'the Frakinator\u2019s bear is watching. it approves of your maths. 🐻' },
      { id: 14, word: 'madness', key: 'egg.word.madness', fallback: 'MADNESS \u2014 the alliance that reads. the bear knows your name. 📖' },
      { id: 15, word: 'bear',    key: 'egg.word.bear',    fallback: 'you said his name. he is now behind you. 🐻' }
    ];
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      var ch = e.key.toLowerCase();
      if (ch < 'a' || ch > 'z') { typedBuf = ''; return; }
      typedBuf = (typedBuf + ch).slice(-12);
      for (var i = 0; i < secretWords.length; i++) {
        var sw = secretWords[i];
        if (eggSeen(sw.id)) continue;
        var at = typedBuf.indexOf(sw.word);
        if (at !== -1 && at + sw.word.length === typedBuf.length) {
          markEgg(sw.id);
          showNote(tr(sw.key, sw.fallback));
        }
      }
    });

    // ── The bear moment — rare, once, then a trophy ────────
    var pawSVG = '<svg class="paw" viewBox="0 0 64 64" aria-hidden="true">' +
      '<ellipse cx="32" cy="42" rx="14" ry="11" fill="currentColor"/>' +
      '<ellipse cx="13" cy="24" rx="5.5" ry="7.5" fill="currentColor"/>' +
      '<ellipse cx="27" cy="13" rx="5.5" ry="7.5" fill="currentColor"/>' +
      '<ellipse cx="42" cy="13" rx="5.5" ry="7.5" fill="currentColor"/>' +
      '<ellipse cx="54" cy="23" rx="5.5" ry="7.5" fill="currentColor"/></svg>';
    function plantTrophy() {
      if (document.querySelector('.paw-trophy')) return;
      var foot = document.querySelector('footer');
      if (!foot) return;
      var trophy = document.createElement('button');
      trophy.type = 'button';
      trophy.className = 'paw-trophy';
      trophy.setAttribute('aria-label', tr('egg.trophyAria', 'the bear has been here'));
      trophy.innerHTML = pawSVG + '<span>' + tr('egg.trophyLabel', 'he has been here') + '</span>';
      trophy.addEventListener('click', function () { showNote(tr('egg.trophyClick', 'he comes back when you re-read the rules.')); });
      foot.appendChild(trophy);
    }
    if (eggSeen(16)) {
      plantTrophy();
    } else if (Math.random() < 0.01) {
      markEgg(16);
      var moment = document.createElement('div');
      moment.className = 'bear-moment';
      moment.setAttribute('aria-hidden', 'true');
      moment.innerHTML = pawSVG + '<p>' + tr('egg.bearMoment', 'the bear sees you.') + '</p>';
      document.body.appendChild(moment);
      requestAnimationFrame(function () { moment.classList.add('show'); });
      setTimeout(function () {
        moment.classList.remove('show');
        setTimeout(function () {
          if (moment.parentNode) moment.parentNode.removeChild(moment);
          plantTrophy();
        }, 700);
      }, 2600);
    }

    // ── Language picker — flag dropdown ────────────────────
    // Custom listbox so real flags render everywhere (Windows
    // shows letter-pairs instead of flag emojis). The button
    // shows the current flag; the open menu lists flag + name.
    var langBtn = document.getElementById('lang-btn');
    var langMenu = document.getElementById('lang-menu');
    if (langBtn && langMenu) {
      var langOptions = Array.prototype.slice.call(langMenu.querySelectorAll('[role="option"]'));
      var pickerOpen = false;

      function setPickerOpen(open, focusList) {
        pickerOpen = open;
        langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        langMenu.hidden = !open;
        langBtn.classList.toggle('open', open);
        if (open && focusList) {
          var current = langMenu.querySelector('[aria-selected="true"]') || langOptions[0];
          current.focus();
        }
      }

      function syncPicker() {
        var current = (window.I18N && window.I18N.lang) || 'en';
        var active = null;
        langOptions.forEach(function (opt) {
          var isSel = opt.getAttribute('data-lang') === current;
          opt.setAttribute('aria-selected', isSel ? 'true' : 'false');
          if (isSel) active = opt;
        });
        if (active) {
          var old = langBtn.querySelector('.flag');
          var fresh = active.querySelector('.flag').cloneNode(true);
          if (old && old.parentNode === langBtn) langBtn.replaceChild(fresh, old);
        }
      }

      function pick(code) {
        setPickerOpen(false);
        langBtn.focus();
        if (window.I18N && typeof window.I18N.switchTo === 'function') {
          window.I18N.switchTo(code);
        } else {
          syncPicker();
        }
      }

      langBtn.addEventListener('click', function () { setPickerOpen(!pickerOpen, true); });
      langBtn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setPickerOpen(true, true);
        }
      });
      langMenu.addEventListener('click', function (e) {
        var opt = e.target.closest('[role="option"]');
        if (opt) pick(opt.getAttribute('data-lang'));
      });
      langMenu.addEventListener('keydown', function (e) {
        var idx = langOptions.indexOf(document.activeElement);
        if (idx === -1) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          langOptions[(idx + 1) % langOptions.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          langOptions[(idx + langOptions.length - 1) % langOptions.length].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick(langOptions[idx].getAttribute('data-lang'));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setPickerOpen(false);
          langBtn.focus();
        }
      });
      document.addEventListener('click', function (e) {
        if (pickerOpen && !langBtn.contains(e.target) && !langMenu.contains(e.target)) {
          setPickerOpen(false);
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && pickerOpen) {
          setPickerOpen(false);
          langBtn.focus();
        }
      });
      document.addEventListener('i18n:change', syncPicker);
      syncPicker();
    }

    // ── Language change: re-format, re-translate, re-paint ──
    document.addEventListener('i18n:change', function () {
      nf = new Intl.NumberFormat(getLocale());
      refreshEggStrings();
      paintRally();
      paintMarch();
    });
  }

  // Run once the active dictionary is applied (i18n.js loads first).
  if (window.I18N) {
    window.I18N.onReady(boot);
  } else {
    boot(); // no i18n file at all — page still works in English
  }
})();
