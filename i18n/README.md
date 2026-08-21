# Translations

The page is translated **client-side, with zero build step** — it stays a plain static
GitHub Pages site. A tiny loader (`../i18n.js`) injects one `<script>` tag per language
(a one-line wrapper around a JSON body) and swaps the text in place. Script tags are
**not CORS-restricted**, so the page works when opened straight from disk (`file://`) —
no local server, no CORS errors.

## How it works

1. **`<head>` resolver** (inline script in `index.html`) picks the language **before first
   paint** in this order: `?lang=` URL param → saved choice (`localStorage "bh_lang"`) →
   browser language → English. It sets `<html lang>` (and `dir` for RTL languages) immediately.
2. **`i18n.js`** loads `i18n/<lang>.js` by appending a `<script>` tag, then applies it:
   - `data-i18n="key"` — replaces `textContent`
   - `data-i18n-html="key"` — replaces `innerHTML` (keep tags/classes byte-identical)
   - `data-i18n-key="key" data-i18n-attr="a b"` — sets attributes only, never text
     (used for `aria-label`, `title`, meta `content`, and the flag-picker button/menu)
   - `data-i18n-n="8"` — substitutes `{n}` in template keys (e.g. `rewards.forgeAria`)
3. **`app.js`** reads every user-visible string (easter eggs, toasts) from the active
   dictionary via `window.I18N.tr(key, fallback)`, formats calculator numbers with the
   active locale, and re-paints on the `i18n:change` event.
4. The topbar flag dropdown (`#lang-btn` + `#lang-menu`) switches live and remembers
   the choice. It is a custom listbox with inline SVG flags (flag emojis render as
   letter-pairs on Windows, so the flags are real SVG).

## Files

| File | Language |
|---|---|
| `en.js` | English (source of truth — edit this first) |
| `es.js` | Spanish |
| `pt-BR.js` | Portuguese (Brazil) |
| `de.js` | German |
| `fr.js` | French |
| `it.js` | Italian |
| `ru.js` | Russian |
| `pl.js` | Polish |
| `tr.js` | Turkish |
| `zh-Hans.js` | Simplified Chinese |
| `zh-Hant.js` | Traditional Chinese |
| `ko.js` | Korean |
| `ja.js` | Japanese |
| `th.js` | Thai |
| `id.js` | Indonesian |
| `vi.js` | Vietnamese |
| `ar.js` | Arabic (first RTL language) |

Each file is exactly:

```js
window.__BH_I18N_DATA = window.__BH_I18N_DATA || {};
window.__BH_I18N_DATA["en"] = {
  …the JSON body…
};
```

## Adding a language

1. Copy `en.js` → `i18n/<code>.js`, translate every value, and make sure the `<code>`
   inside the wrapper's brackets matches the filename (`["<code>"] =`).
2. Keep **every key** identical (206 today) — a missing key falls back to English.
3. Keep all HTML tags, classes and ids byte-identical; translate only the text inside.
4. Never alter numbers, math symbols (`√ × ÷ ≈ Σ ∝ ≤ →`), `{n}`, or proper nouns
   (Bear Hunt, Forgehammer, Frakinator, MadNess, player names).
5. Register the code in `index.html`:
   - one `<li role="option" tabindex="-1" data-lang="<code>">` in `#lang-menu`,
     with its flag SVG (viewBox `0 0 50 30` — 5:3, matching the other flags)
     and the native language name
   - one `<link rel="alternate" hreflang="<code>" href="https://dey.ci/?lang=<code>">`
   - add `<code>` to the `CANON` map in the inline `<head>` script (and any base-code
     alias like `pt` → `pt-BR`)
   - add the `Intl` locale to `LOCALES` in `i18n.js`
   - if the language is RTL, add it to the `DIRS` map in the inline `<head>` script
     **and** in `i18n.js` (e.g. `{ ar: 'rtl' }`) — this is what flips the page direction

## Notes

- **Local files / CORS:** dictionaries are loaded with `<script>` tags rather than
  `fetch`, so opening `index.html` directly from disk works with no server and no CORS
  errors. The loader appends `?_=` (timestamp) to defeat stale caching, matching the
  old `fetch(..., { cache: 'no-cache' })` behaviour.
- **SEO:** Google indexes the default English page (`https://dey.ci/`). The `?lang=` URLs
  are declared via `hreflang` but are primarily for in-app/in-game sharing. If per-language
  SEO ever matters, generate static `/<code>/index.html` copies at build time instead.
- **Fonts:** `Pirata One` / `IM Fell English` cover Latin + Cyrillic via the `Georgia`
  fallback; CJK and Thai fall back to system serif fonts. Acceptable for a first pass —
  a `Noto Sans SC/TH` addition to the Google Fonts link would polish those scripts.
  Arabic uses **Amiri** (body) + **Aref Ruqaa** (display) via `html[lang="ar"]` overrides.
- **Easter eggs:** alliance in-jokes are translated except names. The typed secret words
  (`frak`, `madness`, `bear`) stay English — they only trigger from Latin keyboard input.
- **Numbers:** calculator output uses `Intl.NumberFormat` per locale (e.g. `60.000` in
  Spanish/German, `60,000` in English). Static math in the copy keeps dot decimals as
  universal notation.
- **RTL (Arabic):** `ar` is the first right-to-left language. `styles.css` mirrors the
  few hard-coded directionals with logical properties (`inset-inline-*`), and
  `html[lang="ar"]` swaps in Amiri + Aref Ruqaa and neutralises `letter-spacing`,
  italics and tight heading line-heights (Arabic letters join, have no case/italics,
  and clip under Latin heading metrics). Arabic copy uses `←` where English uses `→`
  for progressions, wraps formulas in `<span dir="ltr">`, and `ar-u-nu-latn` keeps
  calculator digits Western (matching the Latin digits used throughout the copy).
