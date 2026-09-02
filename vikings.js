/* vikings.js — Vikings Vengeance page toys.
   Registers with common.js via window.BH.registerPage: the kill-surface toy
   (cities you reinforce → garrisons scoring for you). The outline reads
   lazily from the active dictionary (vv.* keys, English fallback), so a
   language switch mid-session shows the new language. */
(function () {
  'use strict';

  function boot(BH) {
    // ── Kill-surface toy ───────────────────────────────────
    // Honest by design: there is no published Viking Vengeance damage formula,
    // so this shows the surface (how many garrisons score for you), not a
    // per-wave points estimate. Per-wave points still depend on your share of
    // each garrison. The outline reads from the active dictionary so a
    // language switch mid-session repaints it (see onChange).
    var cities = document.getElementById('vv-cities');
    if (cities) cities.addEventListener('input', function () { paint(BH); });
    paint(BH);
  }

  // ── Kill-surface outline ───────────────────────────────
  // Elements are re-queried on every paint: the i18n loader replaces
  // innerHTML on other nodes, so stale references must never be trusted.
  function paint(BH) {
    var cities = document.getElementById('vv-cities');
    var outline = document.getElementById('vv-outline');
    if (!cities || !outline) return;
    var n = Math.min(6, Math.max(0, parseInt(cities.value, 10) || 0));
    if (n === 0) {
      outline.innerHTML = BH.tr('vv.stand.outZero', '<b>0</b> garrisons \u2014 just the fixed home wave reward. troops at home earn nothing.');
    } else {
      outline.innerHTML = BH.tr('vv.stand.out', '<b>{n}</b> garrisons score for you at once \u2014 <b>{n}\u00D7</b> the kill surface of staying home.').replace(/\{n\}/g, n);
    }
  }

  BH.registerPage({
    boot: boot,
    onChange: function () { paint(BH); }
  });
})();
