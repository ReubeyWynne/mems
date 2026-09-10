/* bear-hunt.js — Bear Hunt page toys.
   Registers with common.js via window.BH.registerPage: the two calculators
   (rally fill, march split). They re-paint on i18n:change so formatted
   numbers follow the active locale. */
(function () {
  'use strict';

  // ── Rally-fill calculator ──────────────────────────────
  // Elements are re-queried on every paint: the i18n loader replaces
  // innerHTML on the output rows, so stale references must never be trusted.
  function paintRally(BH) {
    var rCap = document.getElementById('rally-cap');
    var rPlayers = document.getElementById('rally-players');
    if (!rCap || !rPlayers) return;
    // A blank or negative capacity has no fair share: the dash says "no answer
    // yet", where a coerced 0 read as "the answer is zero".
    var raw = parseInt(rCap.value, 10);
    var T = isFinite(raw) && raw > 0 ? raw : NaN;
    var j = Math.min(15, Math.max(1, parseInt(rPlayers.value, 10) || 1));
    var pOut = document.getElementById('rally-p-out');
    var share = document.getElementById('rally-share');
    var rMult = document.getElementById('rally-mult');
    if (pOut) pOut.textContent = j;
    if (share) share.textContent = BH.fmt(T / j);
    if (rMult) rMult.textContent = BH.mult(Math.sqrt(j));
  }

  // ── March-split calculator ─────────────────────────────
  function paintMarch(BH) {
    var mPool = document.getElementById('march-pool');
    var mQ = document.getElementById('march-q');
    if (!mPool || !mQ) return;
    // Same rule as the rally: no answer is a dash, not a zero.
    var raw = parseInt(mPool.value, 10);
    var P = isFinite(raw) && raw > 0 ? raw : NaN;
    var q = Math.min(6, Math.max(1, parseInt(mQ.value, 10) || 1));
    var qOut = document.getElementById('march-q-out');
    var share = document.getElementById('march-share');
    var mMult = document.getElementById('march-mult');
    if (qOut) qOut.textContent = q;
    if (share) share.textContent = BH.fmt(P / q);
    if (mMult) mMult.textContent = BH.mult(Math.sqrt(q));
  }

  // ── The ❦ in the margin ────────────────────────────────
  // The mark beside "the four rules" is the fifth rule's own whisper: pressing
  // it reveals the rule the page keeps for whoever reads the margin. The copy
  // and the row shipped with the page; only the listener was missing, which
  // left a focusable button that did nothing.
  function wireMarginMark() {
    var mark = document.getElementById('hedera');
    var five = document.getElementById('rulefive');
    if (!mark || !five) return;
    mark.setAttribute('aria-expanded', 'false');
    mark.setAttribute('aria-controls', 'rulefive');
    mark.addEventListener('click', function () {
      var open = five.hidden;
      five.hidden = !open;
      mark.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function boot(BH) {
    wireMarginMark();

    var rCap = document.getElementById('rally-cap');
    var rPlayers = document.getElementById('rally-players');
    if (rCap) rCap.addEventListener('input', function () { paintRally(BH); });
    if (rPlayers) rPlayers.addEventListener('input', function () { paintRally(BH); });
    paintRally(BH);

    var mPool = document.getElementById('march-pool');
    var mQ = document.getElementById('march-q');
    if (mPool) mPool.addEventListener('input', function () { paintMarch(BH); });
    if (mQ) mQ.addEventListener('input', function () { paintMarch(BH); });
    paintMarch(BH);
  }

  BH.registerPage({
    boot: boot,
    onChange: function () { paintRally(BH); paintMarch(BH); }
  });
})();
