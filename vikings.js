/* vikings.js — Vikings Vengeance page toys and easter eggs.
   Registers with common.js via window.BH.registerPage: the kill-surface toy
   (cities you reinforce → garrisons scoring for you) and its deliberate-
   deviation egg. Whisper strings and the kill-surface outline are read lazily
   from the active dictionary (vv.* keys, English fallback), so a language
   switch mid-session shows the new language. */
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
    if (n === 6 && !BH.eggSeen(27)) {
      BH.markEgg(27);
      BH.showNote(BH.tr('vv.egg.toy', 'six garrisons. the bear sails with all of them.'), outline.closest('.calc'));
    }
  }

  BH.registerPage({
    whispers: function () {
      var tr = BH.tr;
      return [
        { id: 21, section: 'top',         line: tr('vv.egg.whisper0', 'the bear reads this page too. he\u2019s learning to row.') },
        { id: 37, section: 'waves',       line: tr('vv.egg.whisper6', 'twenty waves. the bear rows through all of them.') },
        { id: 22, section: 'stand',       line: tr('vv.egg.whisper1', 'every troop at home is a kill nobody scores. the bear counts them.') },
        { id: 24, section: 'online',      line: tr('vv.egg.whisper3', 'wave 17 is the bear\u2019s favourite. everyone is online for wave 17.') },
        { id: 23, section: 'composition', line: tr('vv.egg.whisper2', 'infantry first, archers last. the bear knows the queue.') },
        { id: 25, section: 'hq',          line: tr('vv.egg.whisper4', 'fifteen slots at the longhouse. the bear counts those too.') },
        { id: 26, section: 'heroes',      line: tr('vv.egg.whisper5', 'send the bear-hunt faces. the vikings fear the bear.') }
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
    onChange: function () { paint(BH); }
  });
})();
