/* common.js — shared chrome for every page (home, bear-hunt, vikings-vengeance).
   The pages are fully readable without this file; it only adds a scroll progress
   bar, section highlighting, the cracktro depth pull (front layer), the language
   picker, the event switcher, keyboard/swipe navigation between events, and the
   site-wide bear easter eggs. No dependencies, no data collected.
   i18n: all user-visible strings come from i18n/<lang>.js via window.I18N;
   numbers format per the active locale. Page-specific toys and eggs register
   through window.BH.registerPage(...) and live in bear-hunt.js / vikings.js. */
(function () {
  'use strict';

  function getLocale() {
    return (window.I18N && window.I18N.locale) || 'en-GB';
  }
  function tr(key, fallback) {
    return (window.I18N && window.I18N.tr) ? window.I18N.tr(key, fallback) : fallback;
  }

  var nf = new Intl.NumberFormat(getLocale());

  function fmt(n) {
    if (!isFinite(n)) return '\u2014';
    return nf.format(Math.round(n));
  }
  function mult(n) {
    return n.toLocaleString(getLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 0 }) + '\u00D7';
  }

  // ── Page registration ──────────────────────────────────
  // Page files call BH.registerPage({ whispers, gossip, boot, onChange })
  // before boot runs (boot waits for the active dictionary, which loads
  // asynchronously, or for DOMContentLoaded when i18n is missing entirely).
  var pageCfg = {
    whispers: function () { return []; },
    gossip: function () { return []; },
    boot: function () {},
    onChange: function () {}
  };

  // ── Easter eggs — the bear keeps notes ────────────────
  // One integer in localStorage, bit N = egg N seen (see the spec for the bit
  // registry). Crafted eggs are one-shot discoveries; the gossip pool repeats.
  // Nothing else is ever written.
  var EGG_KEY = 'bh_eggs';
  var seen = 0;
  try { seen = parseInt(localStorage.getItem(EGG_KEY) || '0', 10) || 0; } catch (e) { /* private mode */ }
  function eggSeen(id) { return (seen & (1 << id)) !== 0; }
  function markEgg(id) {
    seen = seen | (1 << id);
    try { localStorage.setItem(EGG_KEY, String(seen)); } catch (e) { /* private mode */ }
  }

  // A single parchment slip, reused. Floating for whispers and toasts; static
  // (anchored inside a .calc) for calculator eggs.
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
    }, anchor ? 4000 : 4400);
  }

  // ── Random margin whispers & alliance gossip ───────────
  // `whispers` are one-shot discoveries (bit N set once), read lazily from the
  // page config so a language switch mid-session picks up the new strings.
  // `gossip` is repeatable alliance lore — no bit, it can recur like alliance
  // chat, rate-limited and capped.
  var lastNoteAt = 0;
  var notesShown = 0;
  function maybeWhisper(sectionId) {
    if (notesShown >= 3 || !sectionId) return;
    var now = Date.now();
    if (now - lastNoteAt < 15000) return;
    var whispers = pageCfg.whispers();
    var gossip = pageCfg.gossip();
    var w = null;
    for (var i = 0; i < whispers.length; i++) {
      if (whispers[i].section === sectionId && !eggSeen(whispers[i].id)) { w = whispers[i]; break; }
    }
    var line = null;
    if (w && Math.random() < 0.015) {
      markEgg(w.id);
      line = w.line;
    } else if (gossip.length && Math.random() < 0.03) {
      line = gossip[Math.floor(Math.random() * gossip.length)];
    }
    if (!line) return;
    notesShown += 1;
    lastNoteAt = now;
    showNote(line);
  }

  // ── Typed words — parchment toasts (site-wide) ────────
  // The secret words stay English in every language (typing is Latin-only by
  // design); the toasts translate.
  var typedBuf = '';
  var secretWords = [
    { id: 13, word: 'frak',    key: 'egg.word.frak',    fallback: 'the Frakinator\u2019s bear is watching. it approves of your maths. \uD83D\uDC3B' },
    { id: 14, word: 'madness', key: 'egg.word.madness', fallback: 'MADNESS \u2014 the alliance that reads. the bear knows your name. \uD83D\uDCD6' },
    { id: 15, word: 'bear',    key: 'egg.word.bear',    fallback: 'you said his name. he is now behind you. \uD83D\uDC3B' }
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

  // ── Event navigation — switcher, keyboard, swipe ───────
  var page = document.documentElement.getAttribute('data-page') || 'home';
  var prevUrl = document.documentElement.getAttribute('data-prev-url') || '';
  var nextUrl = document.documentElement.getAttribute('data-next-url') || '';

  function neighbor(dir) { return dir === 1 ? nextUrl : prevUrl; }

  // Keyboard: ← previous event, → next event (never while typing, inside the
  // language menu, or focused on the lang button / TOC rail).
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var t = e.target;
    if (t && t.closest && t.closest('input, select, textarea, [contenteditable], #lang-menu, #lang-btn, #toc')) return;
    var url = neighbor(e.key === 'ArrowLeft' ? -1 : 1);
    if (url) { e.preventDefault(); window.location.href = url; }
  });

  // Swipe: full-page horizontal drag with a preview panel and a commit bar.
  // Horizontal intent requires |dx| > |dy| before the peek activates, so
  // reading a long page never triggers it (overscroll-behavior-x: none in
  // events.css keeps the browser's edge-swipe from fighting us). Drags
  // starting on form controls or the TOC rail are ignored. Release past
  // ~38% of the viewport (or a fast flick) navigates; short drags spring
  // back — the preview never commits by itself.
  var peek = null;
  var peekMain = null;
  var peekHint = null;
  var g = { startX: null, startY: null, active: false, dir: 0, t0: 0 };

  function makePeek() {
    peek = document.createElement('div');
    peek.className = 'swipe-peek';
    peek.setAttribute('aria-hidden', 'true');
    peek.innerHTML =
      '<span class="peek-kicker"></span>' +
      '<h3 class="peek-title"></h3>' +
      '<p class="peek-lede"></p>' +
      '<span class="peek-hint"></span>';
    document.body.appendChild(peek);
    peekMain = document.querySelector('main');
    peekHint = peek.querySelector('.peek-hint');
  }

  function peekData(dir) {
    var d = document.documentElement;
    var p = dir === 1 ? 'next' : 'prev';
    return {
      url: d.getAttribute('data-' + p + '-url') || '',
      title: d.getAttribute('data-' + p + '-title') || '',
      lede: d.getAttribute('data-' + p + '-lede') || '',
      kicker: dir === 1 ? tr('ev.peek.next', 'next event') : tr('ev.peek.prev', 'previous event')
    };
  }

  function showPeek(dir) {
    if (!peek) makePeek();
    var d = peekData(dir);
    peek.className = 'swipe-peek ' + (dir === 1 ? 'next' : 'prev');
    peek.querySelector('.peek-kicker').textContent = d.kicker;
    peek.querySelector('.peek-title').textContent = d.title;
    peek.querySelector('.peek-lede').textContent = d.lede;
    if (peekHint) peekHint.textContent = tr('ev.peek.release', 'release to open');
    document.body.classList.add('swiping');
  }

  function positionPeek(dx) {
    if (!peek) return;
    // The panel is parked off-screen (translateX ±100%); the finger pulls it
    // toward full reveal with slight resistance, capped so it never blocks.
    var px = dx * 0.7;
    if (g.dir === 1) {
      peek.style.transform = 'translateX(calc(100% + ' + Math.min(0, px) + 'px))';
    } else {
      peek.style.transform = 'translateX(calc(-100% + ' + Math.max(0, px) + 'px))';
    }
  }

  function parallaxMain(dx) {
    if (peekMain) peekMain.style.transform = 'translateX(' + (dx * 0.12) + 'px)';
  }

  function resetPeek() {
    // Add the spring (events.css .snap transition), clear the drag transform,
    // then drop the class once the spring has settled.
    if (peek) { peek.classList.add('snap'); peek.style.transform = ''; }
    if (peekMain) { peekMain.classList.add('snap'); peekMain.style.transform = ''; }
    document.body.classList.remove('swiping');
    setTimeout(function () {
      if (peek) peek.classList.remove('snap');
      if (peekMain) peekMain.classList.remove('snap');
    }, 400);
  }

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, select, textarea, [contenteditable], #toc')) return;
    var touch = e.touches[0];
    g.startX = touch.clientX;
    g.startY = touch.clientY;
    g.t0 = Date.now();
    g.active = false;
    g.dir = 0;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (g.startX === null) return;
    var touch = e.touches[0];
    var dx = touch.clientX - g.startX;
    var dy = touch.clientY - g.startY;
    if (!g.active) {
      if (Math.abs(dx) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { g.startX = null; return; } // vertical intent
      g.dir = dx < 0 ? 1 : -1;
      if (!neighbor(g.dir)) { g.startX = null; return; } // nowhere to go
      g.active = true;
      showPeek(g.dir);
    }
    if (g.active) {
      e.preventDefault(); // horizontal drag: never a click, never a scroll
      positionPeek(dx);
      parallaxMain(dx);
    }
  }, { passive: false });

  function finishDrag(e) {
    if (!g.active) { g.startX = null; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - g.startX;
    var dt = Date.now() - g.t0;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var commit = Math.abs(dx) > vw * 0.38 || (Math.abs(dx) > 60 && dt < 250);
    var dir = g.dir;
    resetPeek();
    g.startX = null;
    g.active = false;
    g.dir = 0;
    if (commit && neighbor(dir)) window.location.href = neighbor(dir);
  }
  document.addEventListener('touchend', finishDrag, { passive: true });
  document.addEventListener('touchcancel', function () {
    if (g.active) { resetPeek(); g.startX = null; g.active = false; g.dir = 0; }
  }, { passive: true });

  // Edge handles — visual affordances on coarse pointers (pointer-events none;
  // the drag works from anywhere, these just say the edge is a door).
  function makeHandle(cls, glyph) {
    var h = document.createElement('span');
    h.className = 'edge-handle ' + cls;
    h.setAttribute('aria-hidden', 'true');
    h.textContent = glyph;
    document.body.appendChild(h);
  }

  // ── Scroll restore — come back to where you were ───────
  var SCROLL_KEY = 'bh_scroll_' + page;
  function saveScroll() {
    try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || document.documentElement.scrollTop || 0)); } catch (e) { /* private mode */ }
  }
  window.addEventListener('pagehide', saveScroll);
  function restoreScroll() {
    if (location.hash) return;
    var s = null;
    try { s = sessionStorage.getItem(SCROLL_KEY); } catch (e) { /* private mode */ }
    if (s) window.scrollTo(0, parseInt(s, 10) || 0);
  }

  // ── Boot — everything above is inert until the active dictionary is
  //    applied (i18n.js loads first), or the DOM is ready without i18n. ──
  function boot() {
    // Scroll progress bar
    var fill = document.getElementById('progress');
    var doc = document.documentElement;
    function paintProgress() {
      if (!fill) return;
      var max = doc.scrollHeight - doc.clientHeight;
      fill.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', paintProgress, { passive: true });
    paintProgress();

    // TOC active section
    var toc = document.getElementById('toc');
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
    var sections = tocLinks
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);

    function revealActive() {
      if (!toc) return;
      var active = toc.querySelector('a.active');
      if (!active) return;
      var r = toc.getBoundingClientRect();
      var a = active.getBoundingClientRect();
      if (a.left < r.left || a.right > r.right) {
        var rtl = document.documentElement.dir === 'rtl';
        var delta = rtl ? (a.right - r.right) : (a.left - r.left);
        var target = toc.scrollLeft + (rtl ? -delta : delta) - (toc.clientWidth - active.offsetWidth) / 2;
        toc.scrollTo({ left: target, behavior: 'smooth' });
      }
    }

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

    // Cracktro depth pull — the section at the read position is the FRONT
    // layer: it alone gets the caret and full brightness. Same observer
    // geometry as the TOC, so the front layer is always the active section.
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
      var hero = document.querySelector('main .hero');
      if (hero) hero.classList.add('front');
    }

    // Event chrome
    if (prevUrl) makeHandle('prev', '\u276E');
    if (nextUrl) makeHandle('next', '\u276F');

    // Language picker — flag dropdown (custom listbox so real flags render
    // everywhere; Windows shows letter-pairs instead of flag emojis).
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

    // Language change: re-format, let the page repaint
    document.addEventListener('i18n:change', function () {
      nf = new Intl.NumberFormat(getLocale());
      pageCfg.onChange();
    });

    // Site-wide bear presence
    if (eggSeen(16)) {
      plantTrophy();
    } else if (Math.random() < 0.005) {
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
      }, 1600);
    }

    // Page toys (calculators, page eggs)
    pageCfg.boot(BH);

    restoreScroll();
  }

  var BH = {
    get page() { return page; },
    fmt: fmt,
    mult: mult,
    tr: tr,
    showNote: showNote,
    eggSeen: eggSeen,
    markEgg: markEgg,
    registerPage: function (cfg) {
      if (!cfg) return;
      if (cfg.whispers) pageCfg.whispers = cfg.whispers;
      if (cfg.gossip) pageCfg.gossip = cfg.gossip;
      if (cfg.boot) pageCfg.boot = cfg.boot;
      if (cfg.onChange) pageCfg.onChange = cfg.onChange;
    }
  };
  window.BH = BH;

  if (window.I18N) {
    window.I18N.onReady(boot);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})();
