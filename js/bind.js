/* bind.js — declared groups: the page's own numbers, said where the reader
   meets them. `data-group="rally"` on a wrapper, `data-in="cap"` on the inputs
   that feed it, `data-i18n-vars="rally"` on the sentence whose `{tokens}` the
   group fills. The page file supplies only the arithmetic:

     BH.group('rally', {
       inputs: ['cap', 'players'],
       values: function (v, BH) {
         var j = Math.min(15, Math.max(1, v.players || 1));
         return { n: j, share: BH.fmt(v.cap / j), mult: BH.mult(Math.sqrt(j)) };
       }
     });

   It replaces re-querying every input and output by id on every paint — a
   discipline that was only ever needed because a dictionary repaint replaces
   the nodes holding the figures. Here nothing holds a node: i18n.js reads the
   group's values at paint time (window.__BH_VARS) and js/bind.js asks it to
   repaint the group's region when an input moves, so a `{token}` in a
   translated sentence carries the reader's own numbers and the dictionary
   carries neither the value nor an id.

   Registration runs as the page file is parsed — before the dictionary lands —
   so the very first paint already has the numbers. Loads after js/common.js
   (which owns BH) and before the page's own toy. No dependencies. */
(function () {
  'use strict';

  if (!window.BH) return;

  var VARS = window.__BH_VARS || (window.__BH_VARS = {});
  var groups = {};
  var scheduled = false;

  function root(name) {
    return document.querySelector('[data-group="' + name + '"]');
  }

  // What the group's inputs say right now. A missing or unparsable input is
  // NaN, never 0 — "no answer yet" and "the answer is zero" are different
  // things, and only the values function knows which it is showing.
  function read(el, names) {
    var out = {};
    for (var i = 0; i < names.length; i++) {
      var node = el.querySelector('[data-in="' + names[i] + '"]');
      var n = node ? parseFloat(node.value) : NaN;
      out[names[i]] = isFinite(n) ? n : NaN;
    }
    return out;
  }

  function values(name) {
    var g = groups[name];
    if (!g) return null;
    if (!g.el) g.el = root(name);
    if (!g.el) return null;
    return g.values(read(g.el, g.inputs), window.BH);
  }

  // The wrapper's listener is delegated, so inputs created later (or nodes a
  // dictionary repaint replaced) are covered without re-binding anything.
  function wire(name) {
    var g = groups[name];
    if (!g || g.wired) return;
    g.el = root(name);
    if (!g.el) return;
    var repaint = function () { paint(name); };
    g.el.addEventListener('input', repaint);
    g.el.addEventListener('change', repaint);
    g.wired = true;
  }

  function paint(name) {
    var g = groups[name];
    if (!g || !g.el || !window.I18N || !window.I18N.refresh) return;
    window.I18N.refresh(g.el);
  }

  function init() {
    for (var name in groups) {
      if (Object.prototype.hasOwnProperty.call(groups, name)) wire(name);
    }
  }

  function group(name, spec) {
    if (!name || !spec || typeof spec.values !== 'function') return;
    groups[name] = { el: null, wired: false, inputs: spec.inputs || [], values: spec.values };
    // i18n.js asks for the values while it paints, so every `{token}` in the
    // dictionary sentence resolves against the inputs as they stand.
    VARS[name] = function () { return values(name); };
    if (!scheduled) {
      scheduled = true;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    } else {
      wire(name);
    }
  }

  window.BH.group = group;
})();
