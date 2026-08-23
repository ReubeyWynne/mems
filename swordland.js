/* swordland.js — Swordland Showdown page toys and easter eggs.
   Registers with common.js via window.BH.registerPage: the 180,000-line
   calculator (occupation × kills → personal points vs the target) and its
   deliberate-deviation eggs. Whisper strings are read lazily from the active
   dictionary (English fallback until the i18n phase adds sw.* keys). */
(function () {
  'use strict';

  // The numbers the transcript actually gives:
  //   best-case occupation income = 3,000 personal/min (shrine + 2 sanctums + 3 abbeys)
  //   combat = 80 personal per 10,000 power defeated attacking, 40 defending
  //   the personal target = 180,000; the match is 55 minutes.
  var OCC_PER_MIN = 3000;
  var ATK_RATE = 80;   // per 10,000 power
  var DEF_RATE = 40;   // per 10,000 power
  var TARGET = 180000;
  var MAX_MIN = 55;

  // ── The 180,000-line calculator ─────────────────────────
  // Honest by design: it only sums what the event publishes — occupation
  // income and combat points. Loot crates are randomised and undercellers
  // are slower, so they stay out of the sum (the note under the toy says
  // exactly that). Elements are re-queried on every paint because the i18n
  // loader replaces innerHTML on the output rows.
  function paint(BH) {
    var occ = document.getElementById('sw-occ');
    var kill = document.getElementById('sw-kill');
    var def = document.getElementById('sw-def');
    if (!occ || !kill || !def) return null;
    var m = Math.min(MAX_MIN, Math.max(0, parseInt(occ.value, 10) || 0));
    var k = Math.max(0, parseInt(kill.value, 10) || 0);
    var d = Math.max(0, parseInt(def.value, 10) || 0);
    var occPts = m * OCC_PER_MIN;
    var killPts = Math.round(k / 10000 * ATK_RATE);
    var defPts = Math.round(d / 10000 * DEF_RATE);
    var total = occPts + killPts + defPts;
    var pct = total / TARGET * 100;
    var occOut = document.getElementById('sw-occ-out');
    var killOut = document.getElementById('sw-kill-out');
    var defOut = document.getElementById('sw-def-out');
    var totalOut = document.getElementById('sw-total');
    var pctOut = document.getElementById('sw-pct');
    if (occOut) occOut.textContent = m;
    if (killOut) killOut.textContent = BH.fmt(k);
    if (defOut) defOut.textContent = BH.fmt(d);
    if (totalOut) totalOut.textContent = BH.fmt(total);
    if (pctOut) pctOut.textContent = BH.fmt(pct) + '%';
    return { m: m, k: k, d: d, total: total };
  }

  function boot(BH) {
    var occ = document.getElementById('sw-occ');
    var kill = document.getElementById('sw-kill');
    var def = document.getElementById('sw-def');
    var calc = occ ? occ.closest('.calc') : null;

    // ── Calculator-state eggs (deliberate deviations only) ─
    // Egg 35: past the 180,000 line in one sitting. Egg 36: the maximum
    // occupation time with nothing else — the deviation that proves the point.
    var pastLine = false;
    function watchTotal() {
      if (pastLine || BH.eggSeen(35)) return;
      var s = paint(BH);
      if (s && s.total >= TARGET) {
        pastLine = true;
        BH.markEgg(35);
        BH.showNote(BH.tr('sw.egg.calc1', 'past the line. the bear salutes the 180,000.'), calc);
      }
    }
    function armOcc() {
      if (!occ || BH.eggSeen(36)) return;
      var k = parseInt(kill && kill.value, 10) || 0;
      var d = parseInt(def && def.value, 10) || 0;
      if (parseInt(occ.value, 10) === MAX_MIN && k === 0 && d === 0) {
        BH.markEgg(36);
        BH.showNote(BH.tr('sw.egg.calc2', MAX_MIN + ' minutes at full occupation still misses. you knew that.'), calc);
      }
    }

    function wire(input, fn) {
      if (!input) return;
      input.addEventListener('input', function () { paint(BH); fn(); });
    }
    wire(occ, function () { watchTotal(); armOcc(); });
    wire(kill, function () { watchTotal(); armOcc(); });
    wire(def, function () { watchTotal(); armOcc(); });
    paint(BH);
  }

  BH.registerPage({
    whispers: function () {
      var tr = BH.tr;
      return [
        { id: 28, section: 'top',       line: tr('sw.egg.whisper0', 'the bear read the signup mail. he\u2019s requesting battle.') },
        { id: 29, section: 'score',     line: tr('sw.egg.whisper1', 'two scoreboards, one duel. the bear reads them both.') },
        { id: 30, section: 'sources',   line: tr('sw.egg.whisper2', 'combat is personal. the bear keeps that one for himself.') },
        { id: 31, section: 'target',    line: tr('sw.egg.whisper3', 'occupation alone misses the line. the bear saw you do the maths.') },
        { id: 32, section: 'arena',     line: tr('sw.egg.whisper4', 'the bear doesn\u2019t turtle the shrine. he\u2019s been burned by mercs.') },
        { id: 33, section: 'matchup',   line: tr('sw.egg.whisper5', 'the bear reads the enemy roster. he\u2019s reading yours.') },
        { id: 34, section: 'matchday',  line: tr('sw.egg.whisper6', 'clear your infirmary. the bear checks his before he queues.') }
      ];
    },
    gossip: function () {
      // The alliance lore is the same across events — reuse the shared pool.
      var tr = BH.tr;
      return [
        tr('egg.gossip0', 'xglitchx is a dinosaur \uD83E\uDD96'),
        tr('egg.gossip1', 'xglitchx is a furry \uD83D\uDC3E'),
        tr('egg.gossip2', 'get in the basement \uD83D\uDD73\uFE0F'),
        tr('egg.gossip3', 'Spooks for King! \uD83D\uDC51'),
        tr('egg.gossip4', 'take a second to r3lax \uD83D\uDE0C'),
        tr('egg.gossip5', 'lucy\u2019s archers scare me \uD83C\uDFF9'),
        tr('egg.gossip6', 'shadow you have how many troops?!? \u2694\uFE0F'),
        tr('egg.gossip7', 'you saving for KvK? \uD83D\uDC8E')
      ];
    },
    boot: boot,
    onChange: function () { paint(window.BH); }
  });
})();
