# Agent instructions — Bear Hunt, Demystified (dey.ci)

Working conventions for agents editing this repo. Short and normative. The site is a
static multi-page site: the home page (`index.html`) plus one directory per event
(`bear-hunt/`, `vikings-vengeance/`, `swordland-showdown/`, each with its own
`index.html`). All user-facing copy lives in the `i18n/<lang>.js` dictionaries
(`en.js` is the source of truth); the HTML text is the English fallback.

## Copy rules

### 1. Never gender the player

The guide speaks to **you** — the player. When writing or editing copy:

- Use the **second person** ("you / your") or gender-neutral constructions. Never use
  "he / she / his / her" (or their equivalents) for a player, a rally lead, a joiner,
  or any human in the described scenario — the reader's gender is never assumed.
  Example voice: "once you're back from your 5th rally as lead, you can still squeeze
  into 1–2 rallies as a joiner…".
- Gendered pronouns are fine **only** when they refer to a **named hero** (heroes have
  fixed in-game genders: "she's such a good leader" for Ava, "he knocks Saul to B" for
  Marlin) or to the bear easter-egg character.
- Some languages cannot express a gender-neutral second person grammatically (Arabic
  most sharply; Russian/Polish partly). Keep those languages' existing grammatical
  conventions. The rule is "no player is assumed to be male or female" — not "strip
  all gender out of the grammar".

### 2. Copy changes propagate to every dictionary

`en.js` and the matching HTML fallback text (on the home page or the event page that
uses the key) are the source of truth. When copy changes,
update the same key in **all 16 translated dictionaries** (`es`, `pt-BR`, `de`, `fr`,
`it`, `ru`, `pl`, `tr`, `zh-Hans`, `zh-Hant`, `ko`, `ja`, `th`, `id`, `vi`, `ar`) to
the corrected meaning — a stale translation that contradicts the English is worse than
an English fallback. Missing keys fall back to English (see `i18n/README.md`), but do
not rely on that for corrections. Non-English edits are AI-pass translations; flag
them for native review.

### 3. Preserve the voice and the format

Keep the site's manuscript voice: lower-case cadence, em-dashes, bold key numbers,
"the maths", "our server". In translations, keep HTML tags/classes/ids byte-identical
and never alter numbers, math symbols (`√ × ÷ ≈ Σ ∝ ≤ →`), `{n}`, or proper nouns
(Bear Hunt, Forgehammer, Frakinator, MadNess, player names).

## Mechanics

- Fonts: body `Alegreya` (400/700 + true italic); display `Cinzel Decorative`
  (400/700/900) for titles — h1/h2 and the topnav `.brand` — via `--display`, and
  `Cinzel` (variable 400–900, no italic) for mid display — h3/h4, numerals — via
  `--display-2`. (An old "Bear Tilde" `@font-face` hack once patched the ASCII
  tilde in the previous Fell/Pirata faces; the current faces don't need it — don't
  resurrect it.) Small display roles (TOC, tags, labels, table
  data) render in the body serif. Cinzel has **no italic** — never italicise display
  text. Emphasis is **bold**, not italic; italic is reserved for the marginal-gloss
  voice (`.note`, `.gen-gloss`, `.egg-note`, `.forge-n`, `.paw-trophy`, `.rev`,
  `.d-formula`).
- File layout: shared CSS is `styles.css` (tokens, base, manuscript components)
  + `events.css` (event switcher, swipe preview, page themes, shared ruled rows
  and checklist); per-page CSS is `home.css`, `vikings.css`, `swordland.css`
  (bear-hunt has none — its components are the shared base). Shared JS is
  `i18n.js` (dictionary loader — resolves `/i18n/` from its own URL, so it
  works from any page depth) + `common.js` (chrome, easter eggs, egg bit
  registry, shared gossip pool); per-page toys live in `bear-hunt.js`,
  `vikings.js`, `swordland.js` and register via `window.BH.registerPage(...)`.
- The TOC scrollspy and front-layer observer in `common.js` pick up new sections
  (`<section class="section" id="…">` + matching `.toc a[href="#…"]`) automatically.
- A new event page = one directory (like `vikings-vengeance/`), a `data-page`
  theme block + dust rules in `events.css`, a per-page CSS file for bespoke
  components, a per-page JS file registering whispers/toys (see the egg bit
  registry in `common.js` before allocating whisper ids), and nav updates in
  the topbar/footer of every page.
- Docs: `MATHS.md` is the formula source of truth; `i18n/README.md` is the
  translation playbook.
