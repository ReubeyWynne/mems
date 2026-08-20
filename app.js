/* Bear Hunt, Demystified — tiny vanilla enhancements.
   The page is fully readable without this file; it only adds
   a scroll progress bar, section highlighting, and the two
   calculators. No dependencies, no data collected. */
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
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  var sections = tocLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && tocLinks.length && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          tocLinks.forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(function (s) { io.observe(s); });
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
})();
