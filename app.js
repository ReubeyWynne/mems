/* Bear Hunt, Demystified — tiny vanilla enhancements.
   The page is fully readable without this file; it only adds
   a scroll progress bar, section highlighting, the cracktro
   depth pull (front layer), and the two calculators.
   No dependencies, no data collected. */
(function () {
  'use strict';

  var nf = new Intl.NumberFormat('en-GB');

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
      var left = active.offsetLeft - (toc.clientWidth - active.offsetWidth) / 2;
      toc.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }

  // Desktop: wheel over the rail scrolls it horizontally.
  if (toc) {
    toc.addEventListener('wheel', function (e) {
      if (toc.scrollWidth > toc.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        toc.scrollLeft += e.deltaY;
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

  // ── Number formatting helper ───────────────────────────
  function fmt(n) {
    if (!isFinite(n)) return '—';
    return nf.format(Math.round(n));
  }
  function mult(n) {
    return n.toFixed(1).replace('.0', '') + '×';
  }

  // ── Rally-fill calculator ──────────────────────────────
  var rCap = document.getElementById('rally-cap');
  var rPlayers = document.getElementById('rally-players');
  var rPOut = document.getElementById('rally-p-out');
  var rShare = document.getElementById('rally-share');
  var rMult = document.getElementById('rally-mult');
  function paintRally() {
    if (!rCap || !rPlayers) return;
    var T = Math.max(1, parseInt(rCap.value, 10) || 0);
    var j = Math.min(15, Math.max(1, parseInt(rPlayers.value, 10) || 1));
    if (rPOut) rPOut.textContent = j;
    if (rShare) rShare.textContent = fmt(T / j);
    if (rMult) rMult.textContent = mult(Math.sqrt(j));
  }
  if (rCap) rCap.addEventListener('input', paintRally);
  if (rPlayers) rPlayers.addEventListener('input', paintRally);
  paintRally();

  // ── March-split calculator ─────────────────────────────
  var mPool = document.getElementById('march-pool');
  var mQ = document.getElementById('march-q');
  var mQOut = document.getElementById('march-q-out');
  var mShare = document.getElementById('march-share');
  var mMult = document.getElementById('march-mult');
  function paintMarch() {
    if (!mPool || !mQ) return;
    var P = Math.max(1, parseInt(mPool.value, 10) || 0);
    var q = Math.min(6, Math.max(1, parseInt(mQ.value, 10) || 1));
    if (mQOut) mQOut.textContent = q;
    if (mShare) mShare.textContent = fmt(P / q);
    if (mMult) mMult.textContent = mult(Math.sqrt(q));
  }
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
  var whispers = [
    { id: 0,  section: 'top',     line: 'the bear reads this page too. he\u2019s taking notes.' },
    { id: 1,  section: 'sqrt',    line: 'the \u221A is the bear\u2019s favourite sign' },
    { id: 2,  section: 'rally',   line: 'a full rally is fifteen players at once. the bear still can\u2019t feel it.' },
    { id: 3,  section: 'marches', line: 'six marches, six fires. the bear watches them. he\u2019s watching yours.' },
    { id: 4,  section: 'timing',  line: 'i see you greeding r3lax\u2019s rally' },
    { id: 5,  section: 'mix',     line: '10/10/80. arrows hurt, who knew?' },
    { id: 6,  section: 'rewards', line: 'we asked the bear for a 19th hammer. century games are watching us now...' },
    { id: 7,  section: 'rules',   line: 'rule five is whispered, never written.' }
  ];
  var gossip = [
    'xglitchx is a dinosaur',
    'xglitchx is a furry',
    'get in the basement',
    'Spooks for King!',
    'take a second to r3lax',
    "lucy's archers scare me",
    'shadow you have how many troops?',
    'you saving for KvK?'
  ];
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
  function armCalcEgg(input, match, eggId, line, anchor) {
    if (!input) return;
    input.addEventListener('input', function () {
      if (eggSeen(eggId)) return;
      var v = parseInt(input.value, 10);
      if (match(v)) {
        markEgg(eggId);
        showNote(line, anchor);
      }
    });
  }
  armCalcEgg(rPlayers, function (v) { return v === 1; }, 8,
    'a lonely rally. the bear approves.', rPlayers ? rPlayers.closest('.calc') : null);
  armCalcEgg(rCap, function (v) { return v === 1000000; }, 9,
    'a 1M rally. the bear salutes. (it has no hands.)', rCap ? rCap.closest('.calc') : null);
  armCalcEgg(mQ, function (v) { return v === 1; }, 10,
    'one march, one \u221A. a single clean line.', mQ ? mQ.closest('.calc') : null);
  armCalcEgg(mPool, function (v) { return v === 1600000; }, 11,
    '16\u00D7 troops, only 4.0\u00D7 damage. the bear saw you do the maths.', mPool ? mPool.closest('.calc') : null);

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
          showNote('seven clicks. the scribe counted too.');
        }
      }
    };
    hedera.addEventListener('click', hederaTap);
    hedera.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hederaTap(); }
    });
  }

  // ── Typed words — parchment toasts ─────────────────────
  var typedBuf = '';
  var secretWords = [
    { id: 13, word: 'frak',    line: 'the Frakinator\u2019s bear is watching. it approves of your maths.' },
    { id: 14, word: 'madness', line: 'MADNESS \u2014 the alliance that reads. the bear knows your name.' },
    { id: 15, word: 'bear',    line: 'you said his name. he is now behind you.' }
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
        showNote(sw.line);
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
    trophy.setAttribute('aria-label', 'the bear has been here');
    trophy.innerHTML = pawSVG + '<span>he has been here</span>';
    trophy.addEventListener('click', function () { showNote('he comes back when you re-read the rules.'); });
    foot.appendChild(trophy);
  }
  if (eggSeen(16)) {
    plantTrophy();
  } else if (Math.random() < 0.01) {
    markEgg(16);
    var moment = document.createElement('div');
    moment.className = 'bear-moment';
    moment.setAttribute('aria-hidden', 'true');
    moment.innerHTML = pawSVG + '<p>the bear sees you.</p>';
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
})();
