/* common.js — shared chrome for every page (home, bear-hunt, vikings-vengeance,
   swordland-showdown, vip-calculator).
   The pages are fully readable without this file; it only adds a scroll progress
   bar, section highlighting, the cracktro depth pull (front layer), the language
   picker, the event switcher, keyboard/swipe navigation between events, and a
   functional toast for genuine feedback (e.g. copy confirmation). No
   dependencies, no data collected.
   i18n: all user-visible strings come from i18n/<lang>.js via window.I18N;
   numbers format per the active locale. Page-specific toys register through
   window.BH.registerPage(...) and live in the per-page files (bear-hunt.js,
   vikings.js, swordland.js, kvk.js, vip.js). */
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
  // Page files call BH.registerPage({ boot, onChange }) before boot runs
  // (boot waits for the active dictionary, which loads asynchronously, or
  // for DOMContentLoaded when i18n is missing entirely). Page files supply
  // only what's theirs: their page toys.
  var pageCfg = {
    boot: function () {},
    onChange: function () {}
  };

  // A single parchment slip, reused — functional feedback only (e.g. the
  // copy confirmation on the Event Cycle page). Fixed bottom-centre so the
  // toast lands the same place every time.
  var note = null;
  function showNote(line) {
    if (note && note.parentNode) note.parentNode.removeChild(note);
    var el = document.createElement('div');
    note = el;
    el.className = 'egg-note';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = line;
    el.style.left = '0';
    el.style.right = '0';
    el.style.bottom = '24vh';
    el.style.margin = '0 auto';
    document.body.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 4400);
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
    if (t && t.closest && t.closest('input, select, textarea, [contenteditable], #lang-menu, #lang-btn, #ledger, #toc')) return;
    var url = neighbor(e.key === 'ArrowLeft' ? -1 : 1);
    if (url) { e.preventDefault(); window.location.href = url; }
  });

  // Swipe: full-page horizontal drag with a preview panel and a commit bar.
  // Horizontal intent requires |dx| > |dy| before the peek activates, so
  // reading a long page never triggers it (overscroll-behavior-x: none in
  // events.css keeps the browser's edge-swipe from fighting us). Drags
  // starting on form controls or the TOC rail are ignored. The preview
  // follows the finger in both directions: past ~14% of the viewport it
  // springs fully open so its content is readable, and it stays fully in
  // only while the finger holds it there — pull back and it re-parks at
  // the finger. Committing is deliberate and positional: releasing while
  // still holding at/past ~38% navigates; every other release springs
  // back, so short or fast drags never navigate on their own.
  var peek = null;
  var peekMain = null;
  var peekHint = null;
  // OPEN_FRAC: how far the finger must travel (fraction of viewport width)
  // before the preview springs fully open — the content is readable long
  // before the release point. COMMIT_FRAC: releasing while still holding
  // at/past this navigates; any release below it springs back.
  var OPEN_FRAC = 0.14;
  var COMMIT_FRAC = 0.38;
  // g.opened is a live view of "the finger is at/past OPEN_FRAC right now",
  // recomputed on every move — never a one-way latch.
  var g = { startX: null, startY: null, active: false, opened: false, dir: 0 };
  var peekHintText = '';

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
      page: d.getAttribute('data-' + p + '-page') || '',
      title: d.getAttribute('data-' + p + '-title') || '',
      lede: d.getAttribute('data-' + p + '-lede') || '',
      kicker: dir === 1 ? tr('ev.peek.next', 'next event') : tr('ev.peek.prev', 'previous event')
    };
  }

  function setPeekHint(text) {
    if (!peekHint || peekHintText === text) return;
    peekHintText = text;
    peekHint.textContent = text;
  }

  function showPeek(dir) {
    if (!peek) makePeek();
    var d = peekData(dir);
    peek.className = 'swipe-peek ' + (dir === 1 ? 'next' : 'prev');
    // The panel wears the destination page's theme (events.css groups the
    // page-theme tokens with .swipe-peek[data-page=…]) so the card reads as
    // the page being navigated to, not the page you're on.
    if (d.page) peek.setAttribute('data-page', d.page);
    else peek.removeAttribute('data-page');
    peek.querySelector('.peek-kicker').textContent = d.kicker;
    peek.querySelector('.peek-title').textContent = d.title;
    peek.querySelector('.peek-lede').textContent = d.lede;
    setPeekHint(tr('ev.peek.dismiss', 'pull back to dismiss'));
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

  function openPeek() {
    if (!peek) return;
    // Spring the preview fully open — readable well before the natural
    // release point. Fires only on a clean crossing into the open zone,
    // while the finger holds at/past OPEN_FRAC. If the finger pulls back
    // below it, touchmove drops .snap and re-parks the panel at the
    // finger, so the spring never fights a reversal.
    peek.classList.add('snap');
    peek.style.transform = 'translateX(0)';
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
    if (t && t.closest && t.closest('input, select, textarea, [contenteditable], #ledger, #toc')) return;
    var touch = e.touches[0];
    g.startX = touch.clientX;
    g.startY = touch.clientY;
    g.active = false;
    g.opened = false;
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
      // A leftover release spring (resetPeek clears .snap after 400 ms) must
      // never rubber-band a drag that starts inside that window.
      if (peek) peek.classList.remove('snap');
      if (peekMain) peekMain.classList.remove('snap');
    }
    if (g.active) {
      e.preventDefault(); // horizontal drag: never a click, never a scroll
      var vw = document.documentElement.clientWidth || window.innerWidth;
      // Drive the preview from the live drag, in both directions, at every
      // stage. "opened" means "|dx| is at/past OPEN_FRAC right now": while
      // the finger holds there the panel stays fully in; pulling back below
      // re-parks it at the finger instead of leaving it locked open.
      if (Math.abs(dx) >= vw * OPEN_FRAC) {
        if (!g.opened) { g.opened = true; openPeek(); }
      } else {
        if (g.opened) {
          g.opened = false;
          // Reversal: drop the spring so the panel snaps back to the finger
          // instantly — the transition must never fight the pull-back.
          if (peek) peek.classList.remove('snap');
          if (peekMain) peekMain.classList.remove('snap');
        }
        positionPeek(dx);
      }
      parallaxMain(dx);
      setPeekHint(Math.abs(dx) >= vw * COMMIT_FRAC
        ? tr('ev.peek.release', 'release to open')
        : tr('ev.peek.dismiss', 'pull back to dismiss'));
    }
  }, { passive: false });

  function finishDrag(e) {
    if (!g.active) { g.startX = null; return; }
    var touch = e.changedTouches[0];
    var dx = touch.clientX - g.startX;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    // Position-only, held-on-release commit: navigate only when the finger
    // lifts while still at/past the commit bar. Any release below it —
    // however fast the flick — springs back via resetPeek, so a short swipe
    // can never navigate, and pulling back before lifting always cancels.
    var commit = Math.abs(dx) >= vw * COMMIT_FRAC;
    var dir = g.dir;
    resetPeek();
    g.startX = null;
    g.active = false;
    g.opened = false;
    g.dir = 0;
    if (commit && neighbor(dir)) window.location.href = neighbor(dir);
  }
  document.addEventListener('touchend', finishDrag, { passive: true });
  document.addEventListener('touchcancel', function () {
    if (g.active) { resetPeek(); g.startX = null; g.active = false; g.opened = false; g.dir = 0; }
  }, { passive: true });

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
          }
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      contentSections.forEach(function (s) { front.observe(s); });
      var hero = document.querySelector('main .hero');
      if (hero) hero.classList.add('front');
    }

    // Event chrome — the preview panel and swipe handles are created lazily
    // on the first drag; no persistent affordances.

    // Home — hover (or focus) an event card and the page previews that
    // event's world: events.css animates every themed token into the
    // destination palette and the dust dissolves into its motes. The
    // ghost card carries no data-hover-page, so it never shifts anything.
    var homeCards = Array.prototype.slice.call(document.querySelectorAll('.event-card[data-hover-page]'));
    if (homeCards.length) {
      var rootEl = document.documentElement;
      homeCards.forEach(function (card) {
        var hoverPage = card.getAttribute('data-hover-page');
        function previewOn() { rootEl.setAttribute('data-hover', hoverPage); }
        function previewOff() { rootEl.removeAttribute('data-hover'); }
        card.addEventListener('mouseenter', previewOn);
        card.addEventListener('mouseleave', previewOff);
        card.addEventListener('focusin', previewOn);
        card.addEventListener('focusout', previewOff);
      });
    }

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

    // Ledger — the ❧ directory drawer (mobile topbar): a fleuron button
    // opens the grouped page list under the bar. Same open/close contract
    // as the language menu: aria-expanded, hidden, Esc + outside-click
    // close, focus moves to the first row and returns to the trigger.
    var ledgerBtn = document.getElementById('ledger-btn');
    var ledger = document.getElementById('ledger');
    if (ledgerBtn && ledger) {
      var ledgerLinks = Array.prototype.slice.call(ledger.querySelectorAll('a'));
      var ledgerOpen = false;
      function setLedgerOpen(open, focusList) {
        ledgerOpen = open;
        ledgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        ledger.hidden = !open;
        ledgerBtn.classList.toggle('open', open);
        if (open && focusList && ledgerLinks.length) {
          var current = ledger.querySelector('a.active') || ledgerLinks[0];
          current.focus();
        }
      }
      ledgerBtn.addEventListener('click', function () { setLedgerOpen(!ledgerOpen, true); });
      ledgerBtn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setLedgerOpen(true, true);
        }
      });
      ledger.addEventListener('keydown', function (e) {
        var idx = ledgerLinks.indexOf(document.activeElement);
        if (idx === -1) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          ledgerLinks[(idx + 1) % ledgerLinks.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          ledgerLinks[(idx + ledgerLinks.length - 1) % ledgerLinks.length].focus();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setLedgerOpen(false);
          ledgerBtn.focus();
        }
      });
      document.addEventListener('click', function (e) {
        if (ledgerOpen && !ledgerBtn.contains(e.target) && !ledger.contains(e.target)) {
          setLedgerOpen(false);
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && ledgerOpen) {
          setLedgerOpen(false);
          ledgerBtn.focus();
        }
      });
    }

    // Language change: re-format, let the page repaint
    document.addEventListener('i18n:change', function () {
      nf = new Intl.NumberFormat(getLocale());
      pageCfg.onChange();
    });

    // Page toys (calculators)
    pageCfg.boot(BH);

    restoreScroll();
  }

  var BH = {
    get page() { return page; },
    fmt: fmt,
    mult: mult,
    tr: tr,
    showNote: showNote,
    registerPage: function (cfg) {
      if (!cfg) return;
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
