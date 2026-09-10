/* common.js — shared chrome for every page (home, bear-hunt, vikings-vengeance,
   swordland-showdown, vip-calculator).
   The pages are fully readable without this file; it only adds a scroll progress
   bar, section highlighting, the cracktro depth pull (front layer), the language
   picker, the event switcher, keyboard/swipe navigation between events, and a
   functional toast for genuine feedback (e.g. copy confirmation). It also warms
   two neighbouring pages once the browser is idle, so a swipe (or an arrow
   key) lands on a page that is already in cache — the cross-document view
   transition that carries the move is in css/events.css. A committed swipe
   spreads the destination's cover (title and all) to the whole frame first and
   leaves the navigation until it has landed, and the arriving page then
   dissolves in over that cover rather than sliding in beside it. No
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

  // A count inside a sentence needs a form for none and one as well as many —
  // "1 days from today" and "0 days from today" are both wrong. Dictionaries
  // carry `<key>Today` and `<key>One` beside the plural `<key>`; fallbacks are
  // given in the same order (none, one, many) so an English default is always
  // right even before a translation adds the two branches. Missing keys fall
  // back to the plural, so calling this is never worse than calling tr().
  function trCount(key, n, fallbacks) {
    var i = n < 1 ? 0 : n === 1 ? 1 : 2;
    return tr(key + (i === 0 ? 'Today' : i === 1 ? 'One' : ''), fallbacks[i]);
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
  //
  // What a commit does is a page turn, not a cut. The card the finger was
  // holding is the destination's own cover; the finger lifts and that cover
  // spreads to the whole frame (commitPeek), the chrome comes back over it,
  // and only then does the navigation leave. The arriving page therefore has
  // a full frame to land on instead of a card to slide past: the view
  // transition in css/events.css holds the cover still and brings the
  // destination in over it (html[data-entry="fold"], stamped by head.html
  // from the one flag common.js leaves behind).
  var peek = null;
  var peekMain = null;
  var peekHint = null;
  // OPEN_FRAC: how far the finger must travel (fraction of viewport width)
  // before the preview springs fully open — the content is readable long
  // before the release point. COMMIT_FRAC: releasing while still holding
  // at/past this navigates; any release below it springs back.
  var OPEN_FRAC = 0.14;
  var COMMIT_FRAC = 0.38;
  // FOLD_MS: how long the cover takes to spread to the frame — kept in step
  // with .swipe-peek.commit::before in events.css. The navigation leaves when
  // that spread reports it is done (transitionend), with FOLD_MS under it as
  // the floor; FOLD_LIMIT is the failure path, so a dead link or a load the
  // reader stopped can never leave them holding a full-screen cover.
  var FOLD_MS = 140;
  var FOLD_LIMIT = 1800;
  var committing = false;
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

  function commitPeek() {
    // The finger lifted past the commit bar: the cover stops being a card and
    // becomes the frame the destination arrives on. --fold is the paper
    // measured against the card, so one transform on the empty paper layer
    // covers the frame exactly and the type never reflows.
    committing = true;
    if (!peek) return;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    // The card may still be springing in when the finger lifts, so the cover
    // is measured from where it is now, not from where it is going: T is how
    // far the parked card still has to travel, and the paper is scaled to
    // cover the frame *plus* that remainder. Whichever way the spring then
    // finishes — and however far the navigation is behind the fold — the
    // paper's anchored edge sweeps past the frame's far side, so no sliver of
    // the page underneath can ever show through at the hand-off.
    var r = peek.getBoundingClientRect();
    var t = Math.max(0, g.dir === 1 ? r.right - vw : -r.left);
    peek.style.setProperty('--fold', (vw + t) / peek.offsetWidth);
    peek.classList.add('snap', 'commit');
    peek.style.transform = 'translateX(0)';
    // The page behind springs home, unseen: a navigation that never lands
    // must leave it where a reader expects it.
    if (peekMain) { peekMain.classList.add('snap'); peekMain.style.transform = ''; }
  }

  function resetPeek() {
    // Add the spring (events.css .snap transition), clear the drag transform,
    // then drop the class once the spring has settled. Dropping .commit too
    // retracts the paper, so the only way back to a card is a whole one.
    if (peek) { peek.classList.add('snap'); peek.classList.remove('commit'); peek.style.transform = ''; }
    if (peekMain) { peekMain.classList.add('snap'); peekMain.style.transform = ''; }
    document.body.classList.remove('swiping');
    setTimeout(function () {
      if (peek) peek.classList.remove('snap');
      if (peekMain) peekMain.classList.remove('snap');
    }, 400);
  }

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    // A committed swipe has already left the reader's hand: the cover is on
    // its way to the frame and the navigation follows it, so a stray finger
    // in that window must not start a second drag on top.
    if (committing) return;
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
    var url = Math.abs(dx) >= vw * COMMIT_FRAC ? neighbor(g.dir) : '';
    if (url) {
      // The cover spreads to the frame, then the navigation leaves: the
      // transition (css/events.css) can only carry out what the old document
      // looks like when it goes, so the turn has to finish here first. The
      // flag is this page's own address, left for the arriving page to read
      // and delete — the one thing the move needs to say, and the only thing
      // common.js ever stores for it.
      try { sessionStorage.setItem('bh:fold', location.href.split(/[?#]/)[0]); } catch (err) { /* private mode: the move falls back to the plain one */ }
      commitPeek();
      var gone = false;
      var leave = function () {
        if (gone) return;
        gone = true;
        window.location.href = url;
      };
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // No fold to wait for: the same reachable page, without the turn.
        leave();
      } else {
        // Leave when the cover has actually finished spreading, not on a
        // clock: a phone that renders the fold late must still hand over a
        // whole one, or the arriving page would slide in over a cover still
        // crawling open. The timer is the floor under that — a paint with no
        // transition to report (and only that) makes good on the move itself.
        var onFold = function (ev) {
          if (ev.target !== peek || (ev.pseudoElement || '').indexOf('before') === -1) return;
          peek.removeEventListener('transitionend', onFold);
          leave();
        };
        peek.addEventListener('transitionend', onFold);
        window.setTimeout(function () {
          peek.removeEventListener('transitionend', onFold);
          leave();
        }, FOLD_MS + 120);
      }
      // Only the failure path reaches this: the reader keeps the page they
      // were on (and the flag, which the next document discards) rather than
      // a full frame of cover with nothing behind it.
      window.setTimeout(function () { committing = false; resetPeek(); }, FOLD_MS + FOLD_LIMIT);
    } else {
      resetPeek();
    }
    g.startX = null;
    g.active = false;
    g.opened = false;
    g.dir = 0;
  }
  document.addEventListener('touchend', finishDrag, { passive: true });
  document.addEventListener('touchcancel', function () {
    if (g.active) { resetPeek(); g.startX = null; g.active = false; g.opened = false; g.dir = 0; }
  }, { passive: true });
  // A back gesture can hand this very document back out of bfcache, fold and
  // all — the turn happened on a page the reader has since left, so the page
  // they return to must be whole and ready for the next swipe.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    committing = false;
    if (peek) peek.style.removeProperty('--fold');
    resetPeek();
  });

  // ── Neighbour warm-up — the other half of the swipe ────
  // The two pages a swipe can reach are known before the finger moves. Once
  // this page is whole and the browser is idle, each neighbour is fetched and
  // read the way the browser will read it: what it asks for is what the swipe
  // will need, so its sheets and toys are prefetched too (this page's own are
  // already in the cache, and anything off-origin is left alone). Both the
  // document and its assets then answer the navigation out of cache, and the
  // cross-document transition has nothing to wait for.
  //
  // Idle, and on the far side of boot, on purpose: a speculative download must
  // never take a byte from the page in front of the reader. Skipped where a
  // download is unwelcome — an explicit data-saver, or a 2G-class connection.
  var warmed = false;
  var prefetched = {};
  function prefetch(url, as) {
    if (!url || prefetched[url]) return;
    prefetched[url] = true;
    var link = document.createElement('link');
    link.rel = 'prefetch';
    if (as) link.as = as;
    link.href = url;
    document.head.appendChild(link);
  }
  function warmNeighbour(href) {
    if (!href) return;
    // The ring's URLs are the page-relative ones the layout wrote, so resolve
    // once here: the fetch, and every asset path lifted out of the neighbour's
    // own markup, hang off this absolute URL.
    var url;
    try { url = new URL(href, location.href).href; } catch (e) { return; }
    fetch(url, { priority: 'low' }).then(function (r) {
      return r.ok ? r.text() : '';
    }).then(function (html) {
      if (!html) return;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var mine = {};
      [].slice.call(document.querySelectorAll('link[rel="stylesheet"][href], script[src]')).forEach(function (el) {
        mine[el.href || el.src] = true;   // links expose href, scripts src
      });
      [].slice.call(doc.querySelectorAll('link[rel="stylesheet"][href], script[src]')).forEach(function (el) {
        var abs;
        try { abs = new URL(el.getAttribute('href') || el.getAttribute('src'), url).href; } catch (e) { return; }
        if (abs.indexOf(location.origin + '/') !== 0 || mine[abs]) return;
        prefetch(abs, el.tagName === 'LINK' ? 'style' : 'script');
      });
    }).catch(function () { /* a neighbour that will not load is not this page's problem */ });
  }
  function warmNeighbours() {
    if (warmed) return;
    warmed = true;
    var c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;
    warmNeighbour(prevUrl);
    warmNeighbour(nextUrl);
  }
  function scheduleWarm() {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(warmNeighbours, { timeout: 2500 });
    } else if (document.readyState === 'complete') {
      // boot can run after the load event (a slow dictionary) — a listener
      // registered now would never fire
      window.setTimeout(warmNeighbours, 400);
    } else {
      window.addEventListener('load', function () { window.setTimeout(warmNeighbours, 400); });
    }
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
      // scaleX, not width: a percentage width dirties layout on every scroll
      // event, while a transform only moves an already-painted layer.
      fill.style.transform = 'scaleX(' + (max > 0 ? doc.scrollTop / max : 0) + ')';
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

    // The page in front of the reader is whole now — only then spend bytes on
    // the pages the swipe can reach (see "Neighbour warm-up" above).
    scheduleWarm();
  }

  var BH = {
    get page() { return page; },
    fmt: fmt,
    mult: mult,
    tr: tr,
    trCount: trCount,
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
