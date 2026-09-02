/* swordland.js — Swordland Showdown page toys.
   Registers with common.js via window.BH.registerPage: the 180,000-line
   calculator (occupation × kills → personal points vs the target). */
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

    function wire(input) {
      if (!input) return;
      input.addEventListener('input', function () { paint(BH); });
    }
    wire(occ);
    wire(kill);
    wire(def);
    paint(BH);
  }

  BH.registerPage({
    boot: boot,
    onChange: function () { paint(window.BH); }
  });
})();
