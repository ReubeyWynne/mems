# Agent instructions — Bear Hunt, Demystified (dey.ci)

Working conventions for agents editing this repo. Short and normative. The site is a
static single-file page (`index.html` + `app.js` + `styles.css`); all user-facing copy
lives in the `i18n/<lang>.js` dictionaries (`en.js` is the source of truth).

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

`en.js` and the matching `index.html` text are the source of truth. When copy changes,
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

- Fonts: body `IM Fell English`, display `Pirata One` — the ASCII tilde rides the
  ascender line in both, so the "Bear Tilde" `@font-face` (unicode-range `U+007E`,
  system-font midline tilde) must stay first in `--body` / `--display`.
- The TOC scrollspy and front-layer observer in `app.js` pick up new sections
  (`<section class="section" id="…">` + matching `.toc a[href="#…"]`) automatically.
- Docs: `MATHS.md` is the formula source of truth; `i18n/README.md` is the
  translation playbook; `ARABIC.md` is the RTL scope record.
