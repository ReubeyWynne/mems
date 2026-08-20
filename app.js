/* Bear Hunt, Demystified — tiny vanilla enhancements.
   The page is fully readable without this file; it only adds
   a scroll progress bar, section highlighting, and the two
   calculators. No dependencies, no data collected. */
(function () {
  'use strict';

  var nf = new Intl.NumberFormat('en-GB');

  // ── Scroll progress bar ────────────────────────────────────
  var fill = document.getElementById('progress');
  var doc = document.documentElement;
  function paintProgress() {
    if (!fill) return;
    var max = doc.scrollHeight - doc.clientHeight;
    fill.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', paintProgress, { passive: true });
  paintProgress();

  // ── TOC active section ─────────────────────────────────────
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  var sections = tocLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && tocLinks.length && sections.length) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          current = entry.target.id;
          tocLinks.forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + current);
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  // ── Number formatting helper ───────────────────────────────
  function fmt(n) {
    if (!isFinite(n)) return '—';
    return nf.format(Math.round(n));
  }

  // ── Rally-fill calculator ──────────────────────────────────
  var rTroops = document.getElementById('rally-troops');
  var rJoiners = document.getElementById('rally-joiners');
  var rJOut = document.getElementById('rally-j-out');
  var rShare = document.getElementById('rally-share');
  var rMult = document.getElementById('rally-mult');
  function paintRally() {
    if (!rTroops || !rJoiners) return;
    var T = Math.max(1, parseInt(rTroops.value, 10) || 0);
    var j = parseInt(rJoiners.value, 10) || 1;
    if (rJOut) rJOut.textContent = j;
    if (rShare) rShare.textContent = fmt(T / j);
    if (rMult) rMult.textContent = (Math.sqrt(j)).toFixed(2).replace(/0$/, '') + '×';
  }
  if (rTroops) rTroops.addEventListener('input', paintRally);
  if (rJoiners) rJoiners.addEventListener('input', paintRally);
  paintRally();

  // ── March-split calculator ─────────────────────────────────
  var mTroops = document.getElementById('march-troops');
  var mQ = document.getElementById('march-q');
  var mQOut = document.getElementById('march-q-out');
  var mShare = document.getElementById('march-share');
  var mMult = document.getElementById('march-mult');
  function paintMarch() {
    if (!mTroops || !mQ) return;
    var P = Math.max(1, parseInt(mTroops.value, 10) || 0);
    var q = parseInt(mQ.value, 10) || 1;
    if (mQOut) mQOut.textContent = q;
    if (mShare) mShare.textContent = fmt(P / q);
    if (mMult) mMult.textContent = (Math.sqrt(q)).toFixed(2).replace(/0$/, '') + '×';
  }
  if (mTroops) mTroops.addEventListener('input', paintMarch);
  if (mQ) mQ.addEventListener('input', paintMarch);
  paintMarch();
})();
