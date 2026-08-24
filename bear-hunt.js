/* bear-hunt.js — Bear Hunt page toys and easter eggs.
   Registers with common.js via window.BH.registerPage: the two calculators
   (rally fill, march split), their deliberate-deviation eggs, and the hedera
   that reveals the whispered fifth rule. Whisper/gossip strings are read
   lazily from the active dictionary so a language switch mid-session shows
   translated toasts; the calculators re-paint on i18n:change so formatted
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
    var T = Math.max(1, parseInt(rCap.value, 10) || 0);
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
    var P = Math.max(1, parseInt(mPool.value, 10) || 0);
    var q = Math.min(6, Math.max(1, parseInt(mQ.value, 10) || 1));
    var qOut = document.getElementById('march-q-out');
    var share = document.getElementById('march-share');
    var mMult = document.getElementById('march-mult');
    if (qOut) qOut.textContent = q;
    if (share) share.textContent = BH.fmt(P / q);
    if (mMult) mMult.textContent = BH.mult(Math.sqrt(q));
  }

  function boot(BH) {
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

    // ── Calculator-state eggs (deliberate deviations only) ─
    // The toast line is read from the dictionary at fire time so a language
    // switch mid-session still shows the right text.
    function armCalcEgg(input, match, eggId, key, fallback, anchor) {
      if (!input) return;
      input.addEventListener('input', function () {
        if (BH.eggSeen(eggId)) return;
        var v = parseInt(input.value, 10);
        if (match(v)) {
          BH.markEgg(eggId);
          BH.showNote(BH.tr(key, fallback), anchor);
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
          if (!BH.eggSeen(12)) {
            BH.markEgg(12);
            var ruleFive = document.getElementById('rulefive');
            if (ruleFive) ruleFive.hidden = false;
            BH.showNote(BH.tr('egg.hedera', 'seven clicks. the scribe counted too.'));
          }
        }
      };
      hedera.addEventListener('click', hederaTap);
      hedera.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hederaTap(); }
      });
    }
  }

  BH.registerPage({
    whispers: function () {
      var tr = BH.tr;
      return [
        { id: 0,  section: 'top',     line: tr('egg.whisper0', 'the bear reads this page too. he\u2019s taking notes.') },
        { id: 1,  section: 'sqrt',    line: tr('egg.whisper1', 'the \u221A is the bear\u2019s favourite sign') },
        { id: 2,  section: 'rally',   line: tr('egg.whisper2', 'a full rally is fifteen players at once. the bear still can\u2019t feel it.') },
        { id: 3,  section: 'marches', line: tr('egg.whisper3', 'six marches, six fires. the bear watches them. he\u2019s watching yours.') },
        { id: 4,  section: 'timing',  line: tr('egg.whisper4', 'i see you greeding r3lax\u2019s rally') },
        { id: 5,  section: 'mix',     line: tr('egg.whisper5', '10/10/80. arrows hurt, who knew?') },
        { id: 6,  section: 'rewards', line: tr('egg.whisper6', 'we asked the bear for a 19th hammer. century games are watching us now...') },
        { id: 7,  section: 'rules',   line: tr('egg.whisper7', 'rule five is whispered, never written.') }
      ];
    },
    // gossip: the alliance lore is shared site-wide — see common.js.
    boot: boot,
    onChange: function () { paintRally(BH); paintMarch(BH); }
  });
})();
