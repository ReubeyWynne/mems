# Arabic (ar) — Scope of Work

**Status: implementation landed.** Decisions resolved: D1 Arab League flag · D2
`ar-u-nu-latn` (Western digits) · D3 Amiri + Aref Ruqaa · D4 AI first pass + native
review. This file remains the record of the scope and the QA checklist.

Adding Arabic is the first **right-to-left** language on this site. Every other
language (16 shipped so far) is LTR, so the existing machinery (`i18n.js`, the
`<head>` resolver, `styles.css`) had **no `dir` handling anywhere** — the page never
set `document.documentElement.dir`, and CSS used hard-coded left/right properties in
a handful of places. Arabic therefore splits into two workstreams:

- **A · Registration + translation** — the standard path documented in `i18n/README.md` (small, mechanical).
- **B · RTL support** — new infrastructure: `dir` plumbing, mirrored CSS, Arabic fonts and typography (the actual work).

---

## 0. Decisions (resolved — see status line above)

| # | Decision | Resolution |
|---|----------|------------|
| D1 | Flag in the language dropdown | **Arab League flag** (green field, white crescent, linked chain) |
| D2 | Calculator numerals | **`ar-u-nu-latn`** — Western digits, consistent with the Latin digits in the copy |
| D3 | Font pairing | **Amiri** (body) + **Aref Ruqaa** (display) — added to the Google Fonts link |
| D4 | Translation method | **AI first pass + native-speaker review** (this dictionary is the AI pass) |

---

## 1. Workstream A — Registration & content (standard, ~30–45 min)

Mechanical; the playbook already lives in `i18n/README.md` ("Adding a language").

1. **`i18n/ar.js`** — copy `en.js`, translate every value (151 keys at the time; the
   dictionary now tracks `en.js` — a missing key falls back to English, loader handles it).
   - Keep the wrapper line's `["ar"]` bracket matching the filename.
   - Keep HTML tags/classes/ids byte-identical; translate only text.
   - Never alter math symbols (`√ × ÷ ≈ Σ ∝ ≤ →`), `{n}`, or proper nouns
     (Bear Hunt, Forgehammer, Frakinator, MadNess, player names).
2. **`index.html`**
   - One `<li role="option" data-lang="ar">` in `#lang-menu` with the D1 flag SVG + «العربية».
   - One `<link rel="alternate" hreflang="ar" href="https://dey.ci/?lang=ar">`.
   - Add `ar` to the `CANON` map in the inline `<head>` script (no base-code alias needed).
3. **`i18n.js`** — add `ar` to the `LOCALES` map (see D2 for the exact `Intl` locale string).
4. **`i18n/README.md`** — add the `ar.js` row to the table + a short "Arabic/RTL" note.
5. **`meta.description` / og tags** — translated via existing `data-i18n-key`/`data-i18n-attr` keys, nothing extra.

**Key count check:** `ar.js` must carry every key `en.js` carries (verified at launch:
151/151; the site later grew a heroes section — `en.js` is now 206 keys and `ar.js` must
track it).

---

## 2. Workstream B — RTL support (the real work, ~2–3 h)

### 2.1 `dir` plumbing (tiny, but must be right)

Today nothing sets `dir`. Two places must learn about it:

- **Inline `<head>` resolver** (`index.html`): after computing `lang`, also set
  `document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr'`. Doing it here — before
  first paint — prevents an LTR→RTL flash on load.
- **`i18n.js`**: in `apply()` and `switchTo()`, sync `document.documentElement.dir` the
  same way `lang` is synced. Use a small map (`DIRS = { ar: 'rtl' }`) so the next RTL
  language is a one-line addition, and default to `ltr`.
- Static `<html lang="en">` can stay; the head script overwrites both attrs at parse time.

### 2.2 CSS — what mirrors automatically vs what needs a fix

**Auto-mirrors (flex/grid follow direction — verify, no code needed):**
`.topbar` row, `.cards` grid, `.facts`, `.brackets`, `.slot-row`/`.slot-grid`,
`.calc-row` (desktop), `.wave-axis`, `.rule-list li` (numbers land on the right),
all `::before` marks (`❧` hedera/leaf marks move to the inline-start side), `.progress`.

**Hard-coded directionals that need touching:**

| Where | Today | Fix |
|---|---|---|
| `.skip-link` | `left: -9999px` / `left: 0` on focus | `inset-inline-start: -9999px` / `inset-inline-start: 0` |
| `.lang-menu` | `position: absolute; right: 0` | `inset-inline-end: 0` — in RTL the menu is anchored at the screen's left edge; with `right: 0` it would open off-screen left |
| `.seg.march` / `.seg.fire` (waves) | `left: calc(...)` | `inset-inline-start: calc(...)` — the wave timeline then runs right→left with the axis |
| `.bar-value` | `text-align: right` | Leave — after the grid auto-mirrors, "toward the track" is still `right`; verify visually |
| `.toc` + `app.js` `revealActive()` | `offsetLeft`/`scrollLeft` centering math | In RTL Chrome reports **negative** `scrollLeft`; simplest robust fix is `active.scrollIntoView({ block: 'nearest', inline: 'nearest' })`, or sign-aware scroll math |

### 2.3 Arabic typography (fonts + script quirks)

The current stacks (`Cinzel Decorative`/`Cinzel` + `Alegreya`, plus `letter-spacing`,
italics, tight heading line-heights) are built for Latin/Cyrillic and actively break
Arabic:

1. **Fonts** — add to the Google Fonts `<link>` in `index.html` (D3):
   `family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700`
   Then in CSS:
   ```css
   html[lang="ar"] {
     --body: 'Amiri', 'Alegreya', 'Georgia', serif;
     --display: 'Aref Ruqaa', 'Amiri', serif;
     --display-2: 'Aref Ruqaa', 'Amiri', serif;
   }
   ```
   Font selection is per-glyph, so Latin runs (brand text, numbers, formulas) keep
   falling through to Alegreya — the manuscript voice survives inside Arabic copy.
2. **`letter-spacing` must be zeroed** — Arabic is cursive; tracking breaks the joins.
   Affected selectors: `h1–h4`, `.brand`, `.tag` (0.2em!), `.chips`, `.toc a`,
   `.foot-main`, `.calc-title` (0.18em), `details summary` (0.14em), `.bars-cap`,
   `.waves-cap`, `.slot-label`, `.brackets li`:
   ```css
   html[lang="ar"] h1, html[lang="ar"] h2, html[lang="ar"] h3, html[lang="ar"] h4,
   html[lang="ar"] .tag, html[lang="ar"] .chips, html[lang="ar"] .toc a,
   html[lang="ar"] .foot-main, html[lang="ar"] .calc-title,
   html[lang="ar"] details summary, html[lang="ar"] .bars-cap,
   html[lang="ar"] .waves-cap, html[lang="ar"] .slot-label,
   html[lang="ar"] .brackets li { letter-spacing: 0; }
   ```
3. **No italics in Arabic** — browsers synthesize ugly obliques. Zero `font-style: italic`
   under `html[lang="ar"]` (`.note`, `strong/b`, `.egg-note`, `.d-formula`,
   `.paw-trophy`, `.foot-sub b`, `.forge-n`); emphasis stays via color/weight.
4. **Heading line-height** — `line-height: 0.98/1.04` clips Arabic ascenders and
   diacritics: `html[lang="ar"] h1, h2, h3, h4 { line-height: 1.2 }`.
5. `text-transform: uppercase` is a harmless no-op on Arabic (no case) — leave it.

### 2.4 Bidi in the copy (translator constraints, `en.js` keys)

- Keys with `→` progressions — `sqrt.lede`, `rally.demoTitle`, `rally.d`, `timing.d3`,
  `mix.d3b` — the arrow is bidi-neutral, so in an RTL paragraph the pair renders flipped.
  The Arabic translation should use `←` for "X → Y" progressions (or the translator
  wraps the run in `<span dir="ltr">`).
- Formula-heavy keys (`sqrt.formula`, `mix.d2`, `rally.d`, `marches.d`) — wrap the math
  in `<span dir="ltr">…</span>` inside the Arabic string so Σ/√/subscript runs stay
  LTR and don't scramble.
- `rewards.forgeAria` = `"{n} Forgehammers"` — **Arabic plural rules** (singular 1, dual 2,
  broken plural 3–10, singular accusative 11+) don't fit one template for n = 8–18.
  Use a structure that reads naturally across the range, e.g. «مطارق: {n}» or the
  colloquial plural «{n} مطارق», and accept the grammar compromise — flag in the
  dictionary review.

### 2.5 app.js

- `revealActive()` RTL scroll fix (§2.2).
- Number formatting needs **no change** — `nf` is rebuilt from `I18N.locale` on every
  `i18n:change` already; only the `LOCALES` entry (A3) decides Eastern vs Western digits.
- Secret typed words (`frak`/`madness`/`bear`) intentionally stay Latin-only — already
  documented, no change; Arabic keyboard input is ignored by design.

---

## 3. QA checklist (browser, no build step — just `?lang=ar`)

- [ ] First paint is RTL (no LTR flash); `<html lang="ar" dir="rtl">` on reload, on
      `?lang=ar`, and after live switch.
- [ ] Flag dropdown: new option present, flag swaps on the button, menu opens on the
      correct side, Escape/arrow keys work.
- [ ] All sections at 3 breakpoints (mobile / 640px / desktop): TOC rail scroll,
      cards grid, rules numbers on the right, brackets wrap, slot grid.
- [ ] Wave diagram: segments run right→left, axis labels 0:00→8:00 mirrored, times row
      uses the `←` form.
- [ ] Bar chart: label/track/value row mirrors; value stays adjacent to the track.
- [ ] Both calculators: output numerals (D2), `60,000` vs `٦٠٬٠٠٠`, multipliers `3.9×`,
      `2.4×` intact; `<output>` values.
- [ ] `details` toggles, hedera 7-click rule-five reveal, egg toasts, typed words,
      trophy, bear moment — all render translated text without scrambling.
- [ ] Arabic headings: no clipped ascenders, no broken letter joins, no fake italics.
- [ ] Mixed Latin-in-Arabic runs (brand, formulas, `Frakinator`, `√`) stay LTR.
- [ ] `hreflang="ar"` alternate present; `?lang=ar` share link works; choice persists.

---

## 4. Translation notes

- The voice is deliberately terse and idiomatic («just the maths»,
  «6 rallies ≈ 2.4× one big march») — a literal translation reads stiff. The Arabic pass
  should aim for the same short, punchy register.
- Keep all 151 keys; if a specific joke doesn't survive contact with Arabic
  (e.g. `egg.whisper4` puns), translate the intent, keep the names (`r3lax` etc.).
- Do **not** translate: Bear Hunt, Forgehammer, Frakinator, MadNess, player handles,
  math symbols, `{n}`, `data-*` attribute strings (`aria-label`s go through keys).

---

## 5. Effort estimate

| Item | Time |
|---|---|
| Registration (A1–A5) | ~30–45 min |
| RTL plumbing + CSS/JS fixes (B) | ~2–3 h |
| Arabic translation (151 keys, AI + human review) | ~1–2 focused sessions |
| QA pass (3 breakpoints + all interactives) | ~45–60 min |
| **Total** | **roughly 1 focused work day**, most of it translation + review |

## 6. Risks / gotchas

- **No `dir` today anywhere** — forgetting the `<head>` resolver causes an RTL flash on load.
- **`scrollLeft` semantics differ in RTL** (negative in Chrome) — the TOC centering will
  jitter or mis-center without the fix.
- **Letter-spacing/italics/line-height** silently break Arabic script — easy to miss in review.
- **`Intl.NumberFormat('ar')` defaults to Eastern Arabic digits**; decide D2 before QA or
  the calculators and copy will disagree about what "60,000" looks like.
- **`{n}` plural** in `rewards.forgeAria` — one template, Arabic wants three forms.
- **Font payload**: Amiri + Aref Ruqaa add ~2 font files; fine for this site's size.
