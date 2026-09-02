/* i18n.js — tiny dictionary loader for Bear Hunt, Demystified.
   Loads i18n/<lang>.js (a one-line JS wrapper around a JSON body)
   via <script> tags, applies it to the [data-i18n*] attributes,
   drives the topbar language switcher, and exposes window.I18N for
   common.js (locale-aware number formatting, translated easter eggs).
   Script tags are not CORS-restricted, so dictionaries load even
   when the page is opened directly from disk (file://) — no server,
   no CORS errors. No dependencies, no data collected. */
(function () {
  'use strict';

  // The dictionaries live in /i18n/ at the site root, but this file is
  // loaded from any page depth (/, /bear-hunt/, …). Resolve the directory
  // from the loader's own URL rather than the document, so every page
  // finds the same /i18n/<code>.js — a document-relative "i18n/…" path
  // would 404 from the event subdirectories.
  function dictBase() {
    var s = document.currentScript;
    if (s && s.src) return s.src.replace(/[^/]*$/, '');
    var tags = document.getElementsByTagName('script');
    for (var i = 0; i < tags.length; i++) {
      var src = tags[i].src || '';
      if (src.indexOf('i18n.js') !== -1) return src.replace(/[^/]*$/, '');
    }
    return ''; // last resort: document-relative 'i18n/…' (home-page layout)
  }
  var DICT_BASE = dictBase();

  var KEY = 'bh_lang';
  var LOCALES = { en: 'en-GB', es: 'es-ES', 'pt-BR': 'pt-BR', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', ru: 'ru-RU', pl: 'pl-PL', tr: 'tr-TR', 'zh-Hans': 'zh-Hans-CN', 'zh-Hant': 'zh-Hant-TW', ko: 'ko-KR', ja: 'ja-JP', th: 'th-TH', id: 'id-ID', vi: 'vi-VN', ar: 'ar-u-nu-latn' };
  // RTL languages (Arabic is the first). Default stays LTR.
  var DIRS = { ar: 'rtl' };

  var lang = window.__BH_LANG || 'en';
  var t = {};                 // active dictionary
  var ready = false;
  var pending = [];

  function tr(key, fallback) {
    return (t && t[key] != null) ? t[key] : fallback;
  }

  // {n} substitution for template keys (e.g. rewards.forgeAria).
  function substitute(str, el) {
    if (str.indexOf('{n}') === -1) return str;
    return str.replace(/\{n\}/g, el.getAttribute('data-i18n-n') || '');
  }

  function apply() {
    var nodes = document.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-key]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n-html') || el.getAttribute('data-i18n') || el.getAttribute('data-i18n-key');
      if (!key || t[key] == null) continue;
      var val = substitute(t[key], el);
      var attrList = el.getAttribute('data-i18n-attr');
      if (attrList) {
        var attrs = attrList.split(/\s+/);
        for (var a = 0; a < attrs.length; a++) {
          if (attrs[a]) el.setAttribute(attrs[a], val);
        }
        continue; // attribute-only elements keep their own text (options, ❦, svg…)
      }
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = val;
      } else if (el.hasAttribute('data-i18n')) {
        el.textContent = val;
      }
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = DIRS[lang] || 'ltr';
  }

  function loadDict(code, done) {
    var s = document.createElement('script');
    s.src = DICT_BASE + 'i18n/' + code + '.js?_=' + Date.now(); // ?_= keeps the old no-cache behaviour
    s.onload = function () {
      t = (window.__BH_I18N_DATA && window.__BH_I18N_DATA[code]) || {};
      done(true);
    };
    s.onerror = function () {
      t = {};
      done(false);
    };
    document.head.appendChild(s);
  }

  function dispatch(name) {
    var evt = document.createEvent('Event');
    evt.initEvent(name, false, false);
    document.dispatchEvent(evt);
  }

  function finish() {
    ready = true;
    var i;
    for (i = 0; i < pending.length; i++) pending[i]();
    pending = [];
    dispatch('i18n:ready');
    dispatch('i18n:change');
  }

  function switchTo(code) {
    if (!code || (code === lang && ready)) return;
    lang = code;
    document.documentElement.lang = lang;
    document.documentElement.dir = DIRS[lang] || 'ltr';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* private mode */ }
    loadDict(lang, function (ok) {
      if (!ok && lang !== 'en') {
        // dictionary missing or corrupt — fall back to English
        lang = 'en';
        try { localStorage.setItem(KEY, 'en'); } catch (e) { /* private mode */ }
      }
      apply();
      dispatch('i18n:change');
    });
  }

  // Public API for app.js. Getters keep lang/locale/t live across switches.
  window.I18N = {
    get lang() { return lang; },
    get locale() { return LOCALES[lang] || lang; },
    get t() { return t; },
    tr: tr,
    switchTo: switchTo,
    onReady: function (cb) { if (ready) cb(); else pending.push(cb); }
  };

  loadDict(lang, function (ok) {
    if (!ok && lang !== 'en') {
      // dictionary missing or corrupt — fall back to English
      lang = 'en';
      try { localStorage.setItem(KEY, 'en'); } catch (e) { /* private mode */ }
    }
    apply();
    finish();
  });
})();
