# Navigation & Event-Cycle Proposal — dey.ci (Kingshot, Demystified)

**Date:** 2026-09-02 · **Status:** design only — no HTML/CSS/JS/i18n was changed
**Ground rules honoured:** AGENTS.md (copy voice, 16-dictionary propagation), DESIGN.md (one-signal-per-page, manuscript grammar, ≤46rem, 1–3px radii), PRODUCT.md (static, no build; "grounded or absent" for gameplay numbers; architecture must assume more pages). All owner-unanswered gameplay facts are marked **OPEN**; nothing is invented.

---

# Section A — Current-state inventory

## A.1 Where page ORDER is encoded today (site-wide)

There is **no JS page registry**. Order exists in exactly four mechanisms, all static:

1. **Topbar `.ev-switch` list** — `<nav class="ev-switch">` in every page's `<header class="topbar">`. Order: Home → Bear Hunt → Vikings → Swordland → KvK/Gov → VIP. Active row = `.active` + `aria-current="page"`.
   - `index.html:89-96` (KvK/Gov link `index.html:94`)
   - `bear-hunt/index.html:85-92` (kvk link `:90`)
   - `vikings-vengeance/index.html:77-84` (kvk link `:82`)
   - `swordland-showdown/index.html:77-84` (kvk link `:82`)
   - `kvk-strongest-governor/index.html:77-84` (active, kvk link `:82`)
   - `vip-calculator/index.html:77-84` (kvk link `:82`)
   - Labels come from `ev.switch.*` keys; **only `ev.switch.kvk` exists as a dictionary entry** (`i18n/en.js:469`, value `"KvK / Gov"`). `ev.switch.home/bear/vikings/swordland/vip` exist **only** in HTML fallback (verified: absent from `i18n/en.js` and from the translated dictionaries — they are English proper-noun labels by design, per PRODUCT.md "proper nouns preserved"). `ev.switchAria` is likewise HTML/JS-fallback only.

2. **Footer `.ev-foot` list** — same six links, same order, repeated in every footer (`<nav class="ev-foot">`):
   - `index.html:192-199` (kvk `:197`) · `bear-hunt/index.html:777-784` (kvk `:782`) · `vikings-vengeance/index.html:415-422` (kvk `:420`) · `swordland-showdown/index.html:457-464` (kvk `:462`) · `kvk-strongest-governor/index.html:505-512` (kvk `:510`) · `vip-calculator/index.html:251-258` (kvk `:256`).
   - CSS: `.ev-switch` shown ≥700px, `display:none` <700px (`events.css:68-70`); `.ev-foot` always shown, wrapping flex (`events.css:51-66`). Brand note also hides <700px (`styles.css:537-539`). On mobile the footer list **is** the only explicit all-pages nav.

3. **Home `.event-grid` card order** — `index.html:138-189` — Bear (`:143`) → Vikings (`:151`) → Swordland (`:159`) → KvK/Gov (`:167-174`) → VIP (`:175-180`) → ghost "Alliance Championship" (`~:181-184`, no `data-hover-page`, `pointer-events:none` via `home.css .event-ghost`). Cards carry `data-hover-page` (`kvksg` on `:167`); `common.js:465-476` wires hover/focus preview via `data-hover` on `<html>`. Home hero chips (`index.html:131-133`) list the events in prose including a plain "kvk & governor" chip (`:132-133`, no i18n key).

4. **Swipe/keyboard chain** — per-page `<html>` attrs, read by `common.js:194-198` (`data-page`, `data-prev-url`, `data-next-url`); keyboard ←/→ at `common.js:200-209`; swipe peek (gesture + preview panel that wears the destination's theme via `data-prev-page`/`data-next-page`, `common.js:243-266`) at `common.js:229-368`. `bh_scroll_<data-page>` session key at `common.js:370-375`.
   **Current chain (a closed forward ring with an open "back" seam at Home):**
   | page (data-page) | file:line | prev (← / swipe-right) | next (→ / swipe-left) |
   |---|---|---|---|
   | home | `index.html:2` | *(none)* | bear-hunt (`../`→`bear-hunt/`) |
   | bearhunt | `bear-hunt/index.html:2` | home `../` | vikings |
   | vikings | `vikings-vengeance/index.html:2` | bearhunt | swordland |
   | swordland | `swordland-showdown/index.html:2` | vikings | **kvk-strongest-governor** (`:2`) |
   | kvksg | `kvk-strongest-governor/index.html:2` | swordland | vip |
   | vip | `vip-calculator/index.html:2` | **kvk-strongest-governor** (`:2`) | home `../` |
   So Home is *inside* the ring as a forward destination (vip → home → bear) but is chain-head for the backward direction (its own `data-prev-url` is absent, so ← on Home does nothing). No cycle loop is possible because Home's back is open.

Secondary order-bearing places (labels/copy, not links): DESIGN.md signals list (`DESIGN.md` "Colors → The Per-Event Signals"), PRODUCT.md capability list (`PRODUCT.md:33`), AGENTS.md mechanics (`AGENTS.md:58-72`), `kvk-strongest-governor/RESEARCH.md:324-327`, `.dsh/kvk-check.js:2` (hard-coded page path), home meta/hero copy (`index.html:7-11,126-136`). Theme blocks in `events.css:341-374` are ordered by hue, not navigation order, and carry no order semantics.

## A.2 Reframe + reorder blast radius (name "Event Cycle", position = first non-home)

All items below must change **in addition to** the order inventory in A.1 (the six topbar lists, six footer lists, home grid order, hero chips, and the whole swipe chain rewire — see Section B for the concrete new values).

**A.2.1 The cycle page itself (`kvk-strongest-governor/index.html`, 525 lines)**
- `<html>` attrs `:2` — swipe prev/next re-point (Section B table).
- `<meta name="description">` `:8`, `og:title` `:9`, `og:description` `:10`, `<title>` `:11-12` — keys `ks.meta.description / ogTitle / ogDescription / title` (`i18n/en.js:476-479`) + HTML fallback text.
- `canonical` + 18 `hreflang` alternates `:19-37` — unchanged **if path is kept**; all change if renamed (A.3).
- Topbar brand `<span class="brand">KVK & <b>GOVERNOR</b></span>` `:76` (no i18n key — plain HTML) → "EVENT CYCLE" or similar.
- `brand-note` `:86` — key `ks.brandNote` (`en.js:480`, value "the 28-day clock") — likely reworded (OPEN copy).
- `.ev-switch` / `.ev-foot` rows `:82` / `:510` — move to slot 2, label key `ev.switch.kvk` → new `ev.switch.cycle` (rename key; value e.g. "Event Cycle").
- TOC `:115-123` — keys `ks.nav.today/cycle/matrix/days/governor/battle/checklist` (`en.js:482-488`). New `#armament`/`#officer` sections (Section D) add `ks.nav.armament`, `ks.nav.officer`.
- Hero `:127-136` — `ks.hero.h1/lede/chip1-4` (`en.js:490-494`), HTML fallback `:128-136`. Copy now says "Two events, one clock" (`:130`) — must be reframed (OPEN copy; voice rules: second person, bold not italic, em-dash cadence).
- `#cycle` `:175-195` — `ks.cycle.title/lede` + wavetable rows `:182-185` with `ks.cycle.w1/w2/w3/w4` (`en.js:509-515`); w1/w3 copy gets the two pair-events named; possibly new schedule rows (Section D).
- `#today` quick-jump buttons `:157-161` — hard-coded English labels "today/Brawl/SG/Mobilize/KvK" (`data-jump="1/8/15/22"`); extend for run starts (Section D).
- Footer `foot-main` "JUST THE CLOCK" `:513` (`ks.foot.main`, `en.js:645`); `foot.note`/`foot.credit` `:514-519` cite KvK-only sources — add Armament/Officer sources (wiki pages) once owner facts land (OPEN).
- `beta-badge` `:129` (kvk.css:6-13) — stays until the page leaves beta (recommendation: keep while new sections land).

**A.2.2 kvk.js (483 lines) — label/name coupling**
- Header comment `kvk.js:1-4` ("KvK & Strongest Governor page toys").
- Card-kicker strings are i18n-keyed, not code-coupled: `prepCard` `:170-189`, `sgCard` `:191-204`, `battleCard` `:205-221`, `offCard` `:223-245` use `BH.tr('ks.today.*')` + `ks.week.*`; short chat labels in copy builders are **hard-coded English** by design (KingShot chat blocks): `SG_SHORT` `:81-85`, `SHORT` `:288-293`, `dayBlock` `:307-317`, `sgCopy` `:319-335`, `battleCopy` `:337-345`, `saveCopy` `:348-360`. Reframe that changes "KVK" copy headers (👑KVK PREP · DAY N etc.) touches these literals, not i18n.
- Whisper registry ids 17–19 `:476-478`; copy egg bit 20 `:433-435` (bit registry comment in `common.js` egg block).

**A.2.3 Home page (`index.html`)**
- `.event-grid` reorder + **card moved to first** (the kvk card `:167-174` becomes the first card); card keys `home.card.kvk.title/lede/chip1-3` (`i18n/en.js:470-474`) → rename to `home.card.cycle.*` with new values; `data-hover-page="kvksg"` unchanged (token decision below).
- Hero chips `:131-133` (fourth chip is a bare HTML span `:132-133`).
- Ghost card `~:181-184` stays last ("Alliance Championship — the list grows", `home.card.soon.*`).

**A.2.4 CSS / theme tokens (identity only — no order semantics, mostly no-op for a pure reframe)**
- `events.css:341-369` `html[data-page="kvksg"] / html[data-hover="kvksg"] / .swipe-peek[data-page="kvksg"]` theme block (sea night + sceptre gold + `.section.sg` crown-gold sub-scope `:364-369`, dust `:372-374`); `home.css:83-92` (`html[data-hover="kvksg"] .dust-g.dust-kvk`, home markup dust group `index.html:85` class `dust-kvk`).
- **Recommendation:** keep the `data-page="kvksg"` token and the `ks.*`/`ks-*` namespace **unless the directory also renames** (A.3). The token is internal (theme scoping + a sessionStorage scroll key `bh_scroll_kvksg`, `common.js:371`); renaming it adds churn with zero user-visible gain. If the directory is renamed to `event-cycle/`, rename the token to `cycle` and update: `events.css:341-374`, `home.css` hover rules, `index.html:167` `data-hover-page`, all `data-prev-page`/`data-next-page` attributes referencing it, and the `.swipe-peek[data-page=…]` selectors. (Clean-cutover exception, documented: the `ks` prefix and element ids `ks-*` — `ks-cycle`, `ks-card`, `ks-day-out`, `ks-copy-out`, `ks-matrix`, `ks-epoch`, `ks-prev/next/today` in kvk.js/kvk.css and `kvk-strongest-governor/index.html` — stay as the *cycle page namespace*; they are referenced ~50 times across kvk.js + the page and carry no user-facing meaning.)

**A.2.5 Scripts / tests / docs that assert titles, links or paths**
- `.dsh/kvk-smoke.js` — loads `kvk.js` (`:40`); asserts, *by rendered card copy*, that day-15 shows "Alliance Mobilization week" and mentions "Armament Competition" (`:61-64`), "hold these" (`:65`), day-20 "matchmaking", day-21 "08:00" (`:69-77`), "KvK prep" day 22 (`:83-84`), prep-day-3 "Pet Training" + "KVK PREP · DAY 3" copy (`:89-94`), SG day-1 "City Construction" (`:98-99`), battle card (`:103-104`). **Mostly survives a reframe** (epoch-anchored dates unchanged) but any day-15/16-20 card changes for run days (Section D) and copy-header literals will require assertion updates.
- `.dsh/kvk-check.js:2` — `fs.readFileSync('kvk-strongest-governor/index.html', …)`: **breaks on a directory rename** (path hard-coded); also enforces "every `data-i18n*` key referenced exists in en.js" — new keys (Section D map) must land in `i18n/en.js` or this check fails.
- `.dsh/refcheck.mjs`, `.dsh/verify-vv.mjs` — per-page scratch checks for vikings/swordland keys; unaffected.
- `.impeccable/*` boot tests (`vikings-boot-test.js`, `swordland-boot-test.js`) assert per-page toy behaviour only — no nav/title assertions. `.impeccable/theme-hover-probe.mjs` drives the home hover preview for **bearhunt/vikings/swordland only** (`:134-232`); kvksg/vip hovers are untested but the mechanism is generic. `.impeccable/design.json` is a design-token snapshot (DESIGN.md mirror) — update only if tokens change (they don't under this proposal).
- Docs: `AGENTS.md:58-72` (file layout + "a new event page = one directory … nav updates in the topbar/footer of every page"), `PRODUCT.md:33,42` (capability + expandable-library constraint — this is the section that says "architecture must assume more pages"), `kvk-strongest-governor/RESEARCH.md:324-327` ("Site plumbing"), header comments in `kvk.css:1-3`, `events.css` theme block comment `:339-341`, `kvk.js:1-4`, and `i18n/en.js` ks-block position.
- i18n propagation fact (verified by grep across `i18n/*.js`): the **entire `ks.*` group exists only in `en.js`** (`i18n/en.js:476-647`); `ru.js`, `es.js`, etc. have **no** `ks.*`, `home.card.kvk.*` or `ev.switch.kvk` keys (checked `ru.js`, `es.js`). The KvK page is English-only today (BETA badge), falling back to HTML text in all 15 other languages. **Consequence:** every key change/rename in this proposal is an `en.js` + HTML edit only; adding the new keys to the 15 dictionaries is a *separate* translation push to schedule when the page leaves beta (flag for the owner; see Section A.4 open items).

## A.3 Rename option: `kvk-strongest-governor/` → `event-cycle/`?

**Full rename touch list (everything that references the string `kvk-strongest-governor`):**
- 6 topbar nav links (A.1) + 6 footer nav links (A.1) + home card link `index.html:167`.
- Swipe-chain URLs + titles: `swordland-showdown/index.html:2` (next), `vip-calculator/index.html:2` (prev), plus the cycle page's own `:2`.
- Canonical + 18 hreflang URLs `kvk-strongest-governor/index.html:19-37`.
- `.dsh/kvk-check.js:2` (hard-coded read path).
- `kvk.css:1` header comment; `kvk-strongest-governor/RESEARCH.md:324`; `kvk.js:1` header comment.
- Optional-but-coherent: `data-page="kvksg"` token + all `kvksg` selector/hover references (A.2.4), `bh_scroll_kvksg` key.

**Old-URL handling on static GitHub Pages (dey.ci, CNAME):**
- GH Pages has **no server-side redirects** (custom domain or not). A directory rename orphans `/kvk-strongest-governor/` → 404.
- The site already has an established static old-URL pattern: the root-level "moved" stubs (`bear-hunt.html`, `vikings-vengeance.html`, `swordland-showdown.html`, `vip-calculator.html`) = `noindex` + `<link rel="canonical">` + `<meta http-equiv="refresh">` + `location.replace(...)` preserving `?lang=` **and** `#hash` (see `bear-hunt.html` for the canonical example).
- Directory→directory renames need the same stub *as a directory*: commit `kvk-strongest-governor/index.html` as a noindex redirect stub to `../event-cycle/` and keep the old directory in the repo permanently (tiny file). Alternative: one custom `404.html` with a `location.pathname` redirect map — needed only if several renames are planned.

**Recommendation: KEEP the path for now** (reframe in place at `/kvk-strongest-governor/`). Reasons:
1. **Share-link trust:** PRODUCT.md's operating model is phone readers mid-event using in-app/`?lang=` share links; the page is days old but a live beta with readers anchored to dates (kvk-smoke anchors 2026-09-01). A rename silently 404s every already-shared link; the GH Pages fix is a permanent stub directory (dead weight in the repo) or a JS 404 map.
2. **Diff hygiene:** the reframe + reorder + two new events is already a large cutover; folding in a repo rename doubles the diff and tangles kvk-check/smoke validation with copy work.
3. The page-level work (Section B) is order/name reframing, which reads correctly at either URL.
**When to revisit:** when the library grows (Alliance Championship etc.) and a rename pattern (per-directory noindex stubs or a 404 map) is adopted once for several pages. If the owner *does* want the rename now, use the per-directory stub pattern above and do it as a separate change after Section B lands — never in the same commit as the content reframe.

---

# Section B — Reorder + reframe cutover plan

## B.1 The proposed global order

> **Home · Event Cycle · Bear Hunt · Vikings Vengeance · Swordland Showdown · VIP Calculator**

Rationale: Event Cycle is the recurring-events hub ("which day is it, what runs now") — the page a returning player needs before any single guide; it also now covers four recurring events, so it reads as the calendar. Bear/Vikings/Swordland stay a cadence run (48h → 2wk → monthly-adjacent), VIP closes as the tool. The home hub and every nav list use this order; the swipe chain mirrors it (below). This matches the owner's ask ("first non-home destination") while keeping VIP last as a tool, not an event.

## B.2 Swipe / keyboard chain rewire (the concrete diff)

New chain — **one forward ring, Home stays the head and stays in the ring**:

| page | prev (← / swipe-right) | next (→ / swipe-left) |
|---|---|---|
| home | *(none — unchanged)* | **`kvk-strongest-governor/`** *(was `bear-hunt/`)* |
| **kvksg / Event Cycle** | **`../` home** *(was `../swordland-showdown/`)* | **`../bear-hunt/`** *(was `../vip-calculator/`)* |
| bearhunt | **`../kvk-strongest-governor/`** *(was `../`)* | `../vikings-vengeance/` |
| vikings | `../bear-hunt/` | `../swordland-showdown/` |
| swordland | `../vikings-vengeance/` | **`../kvk-strongest-governor/`** (same URL; **title/lede + page token attrs change** to the Event Cycle identity) |
| vip | **`../swordland-showdown/`** *(was `../kvk-strongest-governor/`)* | `../` home |

**Home-in-the-chain decision:** keep Home inside the chain, exactly as today — it is the forward destination of vip's `→` (ring: vip → home → Event Cycle → …) — and keep Home's `data-prev-url` **absent**, so `←` at Home does nothing. Justification: (a) today's ring is already closed forward and open backward; preserving the seam means arrow/swipe never loops Home invisibly and the hub is never a surprise stop; (b) backward travel from Event Cycle is `←` → Home, which is the correct "back to the index" muscle memory; (c) Home is reachable in one gesture from anywhere in the ring because vip is always its forward neighbour — the chain self-returns. No `common.js` change is needed for any of this: the logic is purely attribute-driven (`common.js:194-198,200-209,229-368`). `data-page`, `data-prev-page`, `data-next-page` tokens and the `bh_scroll_*` keys keep their current values if the path is kept (A.2.4).

**Per-page attribute edit list (all at line 2 of each file):**
- `index.html:2` — `data-next-url="bear-hunt/"` → `data-next-url="kvk-strongest-governor/"`, `data-next-page="bearhunt"` → `"kvksg"`, `data-next-title="Bear Hunt"` → Event Cycle title, new `data-next-lede`.
- `kvk-strongest-governor/index.html:2` — swap the prev/next halves: prev = `../` home (`data-prev-page="home"`, title "The events", home lede), next = `../bear-hunt/` (bearhunt token/title/lede — reuse the strings currently on `index.html:2`).
- `bear-hunt/index.html:2` — `data-prev-url="../"` → `data-prev-url="../kvk-strongest-governor/"`, `data-prev-page="home"` → `"kvksg"`, prev title/lede → Event Cycle's.
- `swordland-showdown/index.html:2` — `data-next-*` URL stays `../kvk-strongest-governor/` but title/lede text updated to Event Cycle identity (lede: what the reframed page promises — OPEN copy).
- `vip-calculator/index.html:2` — `data-prev-url` → `../swordland-showdown/` with swordland's title/lede; next unchanged (`../`).

## B.3 Cutover checklist (files, in order)

1. **Copy keys** — `i18n/en.js`: rename `ev.switch.kvk`→`ev.switch.cycle` (`:469`), `home.card.kvk.*`→`home.card.cycle.*` (`:470-474`); edit `ks.meta.*` (`:476-479`), `ks.brandNote` (`:480`), `ks.hero.*` (`:490-494`); add the Section D key map; update `ks.nav.*`, `ks.cycle.w1/w3`, `ks.today.mobNote` copy (en.js + HTML fallback in the page).
2. **Every topbar `.ev-switch`** (6 files, rows per A.1): remove "Home…" untouched, move the cycle link from slot 5 to slot 2, retarget `ev.switch.cycle`, add/keep `.active` + `aria-current` on the cycle page itself.
3. **Every footer `.ev-foot`** (6 files, A.1): same reorder.
4. **Home page** `index.html`: hero chips `:131-133`; move kvk/cycle card `:167-174` to the head of `.event-grid` (before `:143`) with renamed keys; keep `data-hover-page="kvksg"`.
5. **Cycle page chrome** `kvk-strongest-governor/index.html`: brand `:76`, brand-note `:86`, TOC `:115-123`, hero `:127-136`, `#cycle` wavetable `:182-185`, `#today` quick jumps `:157-161`, footer copy `:513-519`; add `#armament` + `#officer` sections (Section D) with `<section class="section">` + TOC links (scrollspy/`front` observer pick these up automatically — AGENTS.md:67).
6. **Swipe attrs** — the five files listed in B.2.
7. **Docs** — AGENTS.md:58-72, PRODUCT.md:33-42, DESIGN.md color list §"Colors" (KVK/Gov line if names change), `kvk-strongest-governor/RESEARCH.md` "Site plumbing" `:324-327`, header comments `kvk.css:1`, `kvk.js:1`, `events.css:339-341`; kvk.css has no functional change unless section accents are added.
8. **Tests** — update `.dsh/kvk-smoke.js` assertions that touch changed card copy (Section D.7) and add run-day cases; `.dsh/kvk-check.js` unchanged (path kept) and it will *verify* every new key landed in `en.js`.
9. **Propagate** — new/edited copy keys to the 15 non-English dictionaries only when the page leaves beta (A.4). Until then, en.js + HTML fallback is the complete change set.

---

# Section C — Mobile navigation candidates

**Problem restated:** below 700px the topbar shows only brand + language flag (`events.css:68-70`, `styles.css:537-539`); the *only* explicit all-pages nav is the bottom `.ev-foot` six-link wrap, plus sequential swipe and arrows. For six destinations (and more coming) that is: a long scroll to navigate, no sense of where you are, no way to jump to the hub (Event Cycle) mid-event. The bar is 3rem (`--topbar-h`, `styles.css:55`) with a 3px progress line at its bottom edge (`styles.css:177-178`), so any new affordance must live in that strip and float below it.

Three candidates, all in the manuscript grammar (Cinzel/Alegreya, uppercase letter-spaced labels, ❧ fleuron, 1–3px radii, hairline not box, ink-on-night, one signal per page). Judged against: 3rem chrome, one-signal, typography rules, radii, 46rem measure, i18n lengths incl. Arabic/CJK + RTL, scaling past 6 destinations, keyboard/AT, per-page theme/dust identity.

## Candidate (a) — The ❧ "Ledger Sheet": a topbar drawer listing the index

**What it is.** A fleuron trigger in the topbar (mobile only, <700px) opens a floating "leaf" under the bar: a void-2 sheet, hairline-bordered, listing every destination in groups. It is the Night-Scout's Ledger made literal — the same metaphor as the site title — and it reuses the existing floating-layer vocabulary (`.lang-menu` precedent: void-2, 1px ink-muted border, 3px radius, `0 10px 28px` float shadow, `styles.css:693-696+`) and the existing `❧` active-mark vocabulary (TOC active prefix, `styles.css` `.toc a.active::before`).

**Judgement against constraints:**
- *3rem chrome:* trigger is one small bordered ❧ chip (~2.2rem wide) added to `.topbar-right` before the flag; brand + flag keep their space; progress line untouched (panel hangs below it).
- *One-signal:* the sheet is a *directory*, not a themed surface — it wears the current page's single signal for the active row only; every other row is ink-muted with an ink-dim ❧ on hover. No multi-hue rainbow (violating DESIGN.md's one-signal rule is the failure mode of "theme dots per page" — explicitly avoided).
- *Typography/radii/measure:* group headers are `.calc-title`-style labels; rows are body-serif uppercase (`--step--1`, 0.1em) exactly like `.ev-switch a`/`.ev-foot a`; sheet width `min(92vw, 24rem)` inside the 46rem measure; radii 2px on the trigger, 0–2px on the sheet.
- *i18n incl. Arabic/CJK:* full-width list handles long labels natively (Arabic rows simply run long — no truncation), RTL via logical properties; labels reuse the **existing `ev.switch.*` keys** (plus Home) so *no new translated strings* are required; only the trigger aria + two group headers are new keys (a handful per language, and — since the nav labels are already English proper nouns everywhere — the deltas are tiny).
- *Scales past 6:* the list is grouped ("the events" vs "the tools") and scrolls (`max-height` like `.lang-menu`); new pages are one row, no layout rethink. This is the only candidate whose cost per page stays ~constant.
- *Keyboard/AT:* a real `<button aria-expanded aria-controls>` + a `<nav aria-label>`; arrow/Esc/outside-click dismissal copied from the proven `.lang-menu` wiring in `common.js`; focus moves to the first row on open and returns to the trigger on close; rows are plain `<a>`s — no focus trap needed because the sheet does not claim modal focus.
- *Theme/dust identity:* rows carry no per-page colour, but each row's *destination* is one tap away from its own dust world — and the active row's ❧ rides the current page's `--amber`, so the sheet reads as belonging to the page you're on.

**What dies / what lives:** nothing is deleted. `.ev-switch` remains the ≥700px desktop strip (it is fine at 6 renamed destinations and reads as the "printed index"); `.ev-foot` stays as the long-scroll fallback (long-form norm, and the paw-trophy plants there — `common.js` `plantTrophy`); swipe peek + keyboard arrows stay as the progressive-enhancement layer. **What dies is the mobile *dependency* on the footer for cross-page jumps** — the drawer is the primary mobile directory, one thumb-reach from the top. Honest tradeoff: two coexisting nav systems (tab strip on desktop, drawer on mobile) means future pages are added in more places; the site already pays that cost today (topbar + footer + swipe attrs + home card), and this proposal keeps all four lists fed by the *same* keys so a page add is mechanical.

**Implementation spec (for later, not now):**
- Markup (repeated per page beside `.ev-foot`, in `<header class="topbar">`):
  ```html
  <button type="button" id="ledger-btn" class="ledger-btn" aria-haspopup="true" aria-expanded="false"
          aria-controls="ledger" data-i18n-key="ev.ledger.aria" data-i18n-attr="aria-label">❧</button>
  <nav id="ledger" class="ledger" aria-label="Events" data-i18n-key="ev.switchAria" data-i18n-attr="aria-label" hidden>
    <p class="ledger-group" data-i18n="ev.ledger.home">the index</p>
    <a href="…" data-i18n="ev.switch.home">Home</a>
    <p class="ledger-group" data-i18n="ev.ledger.guides">the events</p>
    <a href="../kvk-strongest-governor/" class="ledger-row" data-i18n="ev.switch.cycle">Event Cycle</a>
    … bear, vikings, swordland …
    <p class="ledger-group" data-i18n="ev.ledger.tools">the tools</p>
    <a href="../vip-calculator/" data-i18n="ev.switch.vip">VIP</a>
  </nav>
  ```
  Active page row gets `.active` + `aria-current="page"`; on mobile the row content can append a short `· {current day context}` only on the Event Cycle row (see Section D — live day), *not* a per-row theme.
- CSS (in `events.css`, shared): `.ledger-btn` mirrors `.kb` (transparent, 1px `--signal-line`, 2px radius, amber on hover/open); `.ledger` = `position:absolute; inset-inline-end:…; top: var(--topbar-h); width:min(92vw,24rem); max-height:62vh; overflow:auto; background:var(--void-2); border:1px solid var(--signal-line); border-radius:3px; box-shadow:0 10px 28px rgba(0,0,0,.55);` rows `.ledger a` styled as `.ev-foot a` + row padding + hairline separators; `.ledger a.active { color:var(--amber) } .ledger a.active::before { content:"❧ " }`. Show `.ledger-btn` only <700px (`@media (max-width:700px)`), hide ≥700px — complementary to `.ev-switch`.
- Motion budget in the theme/dust grammar: sheet entrance `opacity 0→1` + `translateY(-0.4rem)→0`, 0.35s `cubic-bezier(0.16,1,0.3,1)` (the site-wide spring), spring-back on close; rows static (no stagger — keeps reduced-motion/AT simple; the blanket `prefers-reduced-motion` rule collapses transitions). No glow, no dust changes — the dust never moves from `<html>`/`.dust`.
- JS (in `common.js`): clone the `.lang-menu` open/close pattern (`setPickerOpen`/outside-click/Esc at `common.js` ~480-560) for `#ledger-btn`/`#ledger`; `aria-expanded`, `hidden`, focus-first-link on open, restore focus on close. No i18n re-render needed (rows reuse existing keys; the `i18n:change` event already re-applies `data-i18n` attributes).
- New i18n keys (en.js + page HTML fallbacks): `ev.ledger.aria`, `ev.ledger.home`, `ev.ledger.guides`, `ev.ledger.tools` (translate when the next translation push happens; absent keys fall back to English HTML today per `i18n.js tr()`).

## Candidate (b) — Trimmed topbar strip: 2–3 destinations + a ❧ overflow mark

Replace the six-up strip metaphor at all widths with: [brand] · [active page] · [next page] · ❧-overflow (opens the same grouped list as (a)). Honest judgement: it keeps a strong *context* signal (where you are, what's one swipe ahead) and it scales visually, but it **fails discoverability** — 3 of 7+ destinations visible means every other page lives behind the same overflow tap the full list would provide, and the strip still fights long labels in Arabic/CJK at 320px. On this site the "next" slot duplicates what swipe already does; the "active" slot duplicates the brand (which already names the page). Weakest of the three: it solves the bar's *width* problem, not the *findability* problem the owner named. What dies: the `.ev-switch` full list everywhere; `.ev-foot` stays; swipe stays.

## Candidate (c) — Home as the true hub: demote the topbar tabs

Make `index.html`'s `.event-grid` (already the richest list, with hover/focus previews) the *canonical* directory; strip every page's topbar to brand + lang + a single "❧ index" link back Home; leave full lists only in `.ev-foot`; rely on swipe for neighbours. Honest judgement: it matches the mobile-first, one-signal, content-forward product (PRODUCT.md: home is "the list grows", and the grid is the one surface with per-event preview identity), and it costs almost nothing to build. But it **fails the mid-event reader who lands deep** (in-app share links land on guide pages, not Home — PRODUCT.md operating context): from Bear Hunt you would need *two* gestures and a scroll to know Event Cycle exists. It also still makes the hub Home, so "Event Cycle first" exists only inside Home's grid, not in any chrome. What dies: `.ev-switch` everywhere and the drawer need; `.ev-foot` stays; swipe stays. Verdict: right *idea* for the home page's future (its card list should keep mirroring the nav order), wrong as the sole mobile nav.

## Recommendation

**Candidate (a), the ❧ Ledger Sheet drawer.** It is the only option that satisfies every constraint at once — one thumb-reach directory at the top of every page (including deep share-link landings), grouped so the architecture absorbs more pages for free, no new translation burden beyond four small keys, full keyboard/AT parity via the existing `.lang-menu` pattern, and a shape that is *native* to the site's own metaphor (the ledger, the fleuron, the floating leaf — DESIGN.md's "printed, not digitized"). Adopt the *grouping structure* of (a) and keep Home's grid as the visual hub; note in the implementation that when destinations pass ~8, the ≥700px `.ev-switch` strip should be re-evaluated against the same drawer (one breakpoint change) — that is the honest "more pages" exit ramp this recommendation buys.

---

# Section D — Event Cycle content architecture (Armament Competition + Officer Project)

## D.1 Facts that are in (owner = ground truth) vs OPEN

**In (encode as data, not prose):** both events run **twice within cycle days 1–7 and twice again within days 15–21** — i.e. four runs per 28-day cycle each, two in Brawl week, two in Alliance Mobilization week; and **per-run task sets and reward sets change with the day the run started**. This contradicts the wiki's "every 2 weeks" cadence (Armament) and fixed Monday/Friday or Wednesday/Sunday starts (both events) in places — the wiki pages (`kingshotwiki.com/events/armament-competition/`, `…/officer-project/`) are **draft data only** and must not be shipped as numbers until the owner confirms. All per-run specifics below are **OPEN** and are listed verbatim in Section E.

## D.2 The data model (kvk.js)

The current wheel is one axis (`weekOf`, `kvk.js:126-132`: `brawl` 1–7 / `sg` 8–14 / `mob` 15–21 / `prep` 22–26 / `battle` 27–28) driving `paintCycle` (`:137-157`), the today card (`render` `:247-265` → `prepCard/sgCard/battleCard/offCard` `:170-245`), the matrix highlight (`:268-284`) and the KingShot copy builders (`:307-360`). The two pair-events are a **second, orthogonal axis** — they do not change `weekOf` (they run *inside* brawl/mob weeks) — so the model stays `weekOf` for the phase plus a new run table:

```js
// PAIR_EVENTS — the recurring pair-events that run inside the brawl (1–7)
// and mob (15–21) weeks. Owner rule: each runs twice per window, four times
// per 28-day cycle; a run's task set and reward set depend on the day it
// started. `start` = cycle day the run opens (1..28); `len` = days it runs.
// All values below are OPEN — owner to supply (see NAV-PROPOSAL Section E).
var PAIR_EVENTS = {
  armament: {
    i18n: 'ks.arm',                      // key prefix for this event's copy
    short: 'Arm',                        // KingShot-copy short label
    week:  ['brawl', 'mob'],             // windows this event runs in
    runs:  [ { start: OPEN, len: 2, variant: OPEN },   // run 1 · days 1–7
             { start: OPEN, len: 2, variant: OPEN },   // run 2 · days 1–7
             { start: OPEN, len: 2, variant: OPEN },   // run 3 · days 15–21
             { start: OPEN, len: 2, variant: OPEN } ], // run 4 · days 15–21
    scale: 'tc',                         // how thresholds scale (OPEN: Town
                                         // Center level? server age? both?)
  },
  officer: {
    i18n: 'ks.off', short: 'Off',
    week:  ['brawl', 'mob'],
    runs:  [ { start: OPEN, len: 2, variant: OPEN }, … 4 runs … ],
    scale: 'age',
  }
};
```

Per-run **variant** tables (only *variant A/B placeholders* today — the start-day → variant map is OPEN, and so is whether variants are two (wiki's Type 1/Type 2) or more):

```js
// A variant = the task table + milestone ladder + rewards a run uses.
// Every numeric field below is OPEN; the keys are the only thing defined now.
var ARMAMENT_VARIANTS = {
  // e.g. 'forge' (wiki Type-1-ish: truegold/gear/spend family) and
  //      'dust'  (wiki Type-2-ish: forgehammer/widget/mithril family)
  // → concrete ids depend on the owner's start-day map (OPEN).
};
// Same shape for OFFICER_VARIANTS (wiki Type A = charms+mithril+training /
// Type B = gear+shards are *candidate drafts only*).
```

Field dictionary per variant (each field is a labelled slot; values OPEN until the owner answers Section E):
- `id` — stable variant identifier (short ASCII, e.g. `forge`, `dust`) used by the run table and copy short-labels.
- `startWeekdays` (OPEN) — the weekday/cycle-day rule that selects this variant (owner: "start-day dependent"; the wiki's Mon/Fri, Wed/Sun alternation is a candidate, not a fact).
- `tasks[]` — one row per scoring activity, each `{ nameKey, pts }` where `nameKey` = i18n key for the task label and `pts` = points per unit (unit description lives in the label; KvK grammar already mixes "per upgrade", "per 1 min", "per troop tier" — mirror `.pt` table rows on the page).
- `milestones[]` — `{ m, threshold, rewardKey }` ladder rows (thresholds OPEN; rewardKey = i18n key for the fixed reward line).
- `rankRewards` — leaderboard reward description (OPEN; wiki says kingdom-rank rewards are the same across both Armament types — confirm).
- `overlap` — whether its tasks can double-count with the hosting week's other events (Brawl/Swordland Sunday / Alliance Mobilization), which the wiki claims for Armament (OPEN confirm; it changes what the today card says).

New pure functions in kvk.js (beside `weekOf`/`sgDayOf`/`prepDayOf` at `:126-134`):
- `runWindow(d, event)` → the run object whose `[start, start+len)` contains cycle day `d`, or null.
- `liveRuns(d)` → list of `{ event: 'armament'|'officer', run: 1..4, start, end, variant }` live on day `d` (0–2 items; they never collide with sg/prep/battle because the owner constrains them to brawl/mob weeks — but the function must *derive* that from PAIR_EVENTS, not assume it).
- `runDayNote(d)` → the i18n-driven line used by the today card and the wheel cells.

## D.3 How the existing machinery changes

- **`weekOf`** — unchanged; it stays the phase axis (`:126-132`).
- **`paintCycle`** (`:137-157`) — each `.cell` can additionally carry a `run` marker class (`arm`/`off`) when `liveRuns(d)` is non-empty, and the cell's `aria-label`/`title` gains a run suffix. With run days OPEN, the marker pass is written against `PAIR_EVENTS` and renders nothing until `start` values exist. Legend (`ks.week.*` labels, `:140-144`) may gain a second legend row naming the pair-events.
- **Today card** (`render`/`offCard` `:223-265`) — the brawl/mob off-card becomes *day-aware*:
  - no pair-event live → current hold-list card (kept);
  - one or two runs live → the card's body prepends compact per-run zones ("Armament Competition · run 2 of the week · variant B — spend today / don't touch", rows in the existing `.trow`/`.zone` grammar, `kvk.css` `.today-zone/.trow`), with a link/anchor to the full section; the hold list stays beneath, now filtered by what the live run spends (the whole point of day-aware guidance: Officer type that eats Gov charms / Mithril / shards conflicts with the SG-prep hoard in week 1 — spend-vs-save guidance is content the owner must sign off, OPEN).
  - `ks.today.brawlNote` / `ks.today.mobNote` (`en.js:518-519`, `kvk.js:242-243`) — rewrite: the current mobNote ("skip the Armament Competition and Officer Project rankings, just take the fixed rewards…") is exactly the kind of blanket claim the day-aware model replaces; keep the "fixed rewards > rankings" stance as voice guidance but make the spend rows concrete per run (OPEN numbers).
  - The KingShot copy builder for run days is a new `pairRunCopy(event, run)` beside `saveCopy` (`:348-360`) — same ≤6-line/512-char contract; its chat labels come from `PAIR_EVENTS[i18n]` + variant short labels, so *no* new hard-coded English beyond the existing SHORT dictionaries (`:288-293`) which should gain any new material names (e.g. `'Truegold Dust'`, `'Tempered Truegold'`, `'Officer'`) once facts land.
- **`#cycle` wavetable** (`kvk-strongest-governor/index.html:182-185`) — keep the four week rows (the phase overview) and edit `ks.cycle.w1`/`w3` copy (`en.js:512,514`) to name the pair-events and their two-run rhythm; optionally add two thin `.wt-row` sub-lines showing each event's run days once `PAIR_EVENTS` is filled (rows reuse `.wt-row`/`.wt-waves`/`.wt-type`, `events.css:384-402`; two new `.wt-type` modifier classes for the event names if colour-coded, else ink-muted like `.wt-type.city`).
- **Quick-jump buttons** (`:157-161`) — the four week jumps stay; add a second `.cycle-quick` row of run jumps generated from `PAIR_EVENTS` (only renders buttons for runs whose `start` is known; labels from i18n, e.g. "Arm 1", "Arm 2", "Off 1"…). Wiring is the existing `[data-jump]` handler (`kvk.js:451-456`).
- **`render`'s day-out readout** (`:247-250`) — unchanged format; run-day suffix is a separate `ks.today.runOut` line in the card, not the readout.

## D.4 New page sections

Two new `<section class="section">` blocks between `#cycle` (`:175-195`) and `#matrix` (`:198`), so the wheel narrative flows clock → what runs inside weeks 1 & 3 → prep tools. Each section is a self-contained guide page *fragment* in the existing grammar (`.day`/`.pt` point tables, `.legend`, `.facts`, `.note`, `.checklist`, `.wavetable` — all already in styles.css/events.css/kvk.css):

- **`#armament` — "Armament Competition"** — lede (what it is, when it runs: twice in weeks 1 & 3 — the owner's rule), a mini wavetable of the four runs (days once OPEN), then per-variant blocks: one `.day` per variant with an `.pt` task table + a milestone ladder `.pt` (rows = milestones M1…M4, threshold + reward) + rank-rewards `.note`, and an overlap `.note` (double-counting with Brawl/Mobilization — OPEN confirm). Reuse `.section.sg`-style accent? No — one signal per page: these sections wear the page's sceptre gold like the prep sections; only the SG sections keep the crown-gold step-up (`events.css:364-369`). *(If the owner wants Armament/Officer to read as distinct worlds, that is a DESIGN.md decision — see Section E open items; default is same-gold.)*
- **`#officer` — "Officer Project"** — same anatomy (four-run schedule, per-variant task + milestone tables, hoard-conflict `.note` spelling out which KvK/SG-precious materials the day's variant consumes).
- TOC: add `ks.nav.armament` / `ks.nav.officer` after `ks.nav.cycle` (`en.js:482-488` + `:117`-area HTML); scrollspy + front-caret pick them up automatically (AGENTS.md:67, `common.js` TOC/front observers).
- New CSS needed: only small, additive classes — a `.run-chip`/`.wt-type` modifiers for the two event names and (optionally) a `.today-run` sub-zone divider. Everything else maps onto `.day`, `.pt`, `.trow`, `.zone`, `.note`, `.legend`, `.wavetable`. kvk.css header comment (lines 1-3) updated.

## D.5 New + changed i18n key map (all `ks.*`; en.js + HTML fallback; the 15 dictionaries follow at the translation push)

**Changed values (reframe):** `ks.meta.title/description/ogTitle/ogDescription` (`:476-479`), `ks.brandNote` (`:480`), `ks.hero.h1/lede/chip1-4` (`:490-494`), `ks.nav.today/…/checklist` copy where section names shift, `ks.cycle.title/lede` + `ks.cycle.w1/w3` (`:509-515`), `ks.today.brawlNote/mobNote` (`:518-519`), `ks.foot.main/note` (`:645-646`), `ks.egg.copy` (`:643`).
**Renamed:** `ev.switch.kvk`→`ev.switch.cycle` (`:469`), `home.card.kvk.*`→`home.card.cycle.*` (`:470-474`).
**New (page sections, schedule, card):**
```
ks.nav.armament        ks.nav.officer
ks.arm.title           ks.arm.lede            ks.arm.scheduleTitle
ks.arm.runAria         ks.arm.run {n}         ks.arm.runOfWeek      (run n of the week)
ks.arm.v{id}.title     ks.arm.v{id}.lede      ks.arm.v{id}.task{i}  (per-task labels)
ks.arm.v{id}.m{i}      ks.arm.milestone       (ladder column headers)
ks.arm.reward{i}       ks.arm.rankNote        ks.arm.overlap        ks.arm.hoard
ks.arm.copyTitle       ks.arm.copyBtn         (reuse ks.today.copy* pattern)
ks.off.*  (same shape, ks.off prefix)
ks.today.kickerArm     ks.today.kickerOff     ks.today.runLive      ("run {n} live")
ks.today.runSpend      ks.today.runHold       (zone headers inside the run card)
ks.cycle.pair          (the two-run-per-week rule line under the wheel)
ks.ledger.aria         ks.ledger.home         ks.ledger.guides      ks.ledger.tools   (Section C)
```
Task *labels* that repeat the KvK/SG material vocabulary should **reuse existing keys** where identical rows exist (e.g. the `.day` tables already print "Mithril 40,000", "Hero Gear Forgehammer 4,000", "Governor Charm max score +1 70" as *page HTML*, not keys — mirror that: static `.pt` rows stay HTML + en.js, following the current kvk page pattern where only section copy is keyed). Per-task i18n keys are only needed where the today card renders the row dynamically (`ks.today` card + KingShot copy), matching how `prepCard`/`sgCard` rows draw from JS data today.

## D.6 Voice / copy posture

Not writing final copy; the new sections must keep: second person, no player gender, **bold** not italic for key numbers (italic only for `.note` marginalia), em-dash cadence, F2P-friendly stance and "fixed rewards beat the rankings" as the alliance stance (existing `ks.today.mobNote`/`ks.governor.rank` spirit), proper nouns preserved (Armament Competition, Officer Project, Forgehammer, Truegold Dust, Mithril…), and **no invented numbers** — every `.pt` cell stays a placeholder until the owner's facts land, with the section marked like the current prep tables ("check your own ladder in-game" framing where the game itself scales thresholds, `en.js:497`).

## D.7 Test impact (`.dsh`)

- `.dsh/kvk-smoke.js` — add: a run-day case (e.g. epoch set so today lands on an Armament/Officer run day → card contains the run zone and `run n` copy), and update the day-15 assertions (`:61-65`) if the mob card shape changes; the epoch-anchored arithmetic (`:54-104`) is otherwise stable. Copy-hygiene helper `copyOK` (`:47-53`) applies unchanged to the new run copy.
- `.dsh/kvk-check.js` — unchanged path; will fail until every new `data-i18n*` key exists in `en.js` (good gate).
- Whisper registry: new sections may earn whispers — allocate fresh ids in the **43+ band** (registry in `common.js` egg comment: 17–19 kvksg, 20 kvksg copy egg, 21–37 vikings/swordland, 38–42 vip are taken; never reuse a released bit).
- Easter-egg copy bit 20 (`kvk.js:433-435`) — fine as-is; a new run-day copy egg would take bit 43+.

---

# Section E — Open questions for the owner

**Gameplay facts (owner is the only source; wiki is draft data):**
1. **Armament Competition — the four run starts:** which cycle days do its two runs in days 1–7 and its two runs in days 15–21 start on, and how long does each run last (wiki says 2-day, Mon–Tue / Fri–Sat — confirm or correct)?
2. **Officer Project — the four run starts:** same question for its four runs (wiki says 2-day, Wed / Sun — confirm or correct)?
3. **Start-day → variant map:** for each event, which start day (cycle day and/or weekday) selects which task/reward set? Is the "day" that matters the run's *start* weekday (calendar) or the cycle day?
4. **Armament task tables:** per variant, the full scoring list (the wiki's Type-1 ≈ Gov-Gear/Truegold/spend family: 3/score, shards 15/50/125, speedup 1/min, Truegold-on-building 100, +Truegold Dust 50, Tempered 1500 — and Type-2 ≈ Forgehammer 800 / Widget 1600 / Mithril 8000 family — are **candidate drafts only**). Which rows are right for our server/age, what points do they award, and what did the wiki get wrong?
5. **Officer task tables:** per variant (wiki Type A "Infantry & Charms": Gov Charm +1 = 70, Mithril = 60,000, troop-training ladder T1–T11 = 1…37; Type B "Governor Gear & Hero Shards": Gov Gear +1 = 70, Rare 350 / Epic 1,220 / Mythic 3,040 — **candidate drafts only**). Confirm or correct per variant.
6. **Milestone ladders:** per event per variant — milestone count (wiki: Officer has 4 milestones + Honor Ranking), thresholds, and each milestone's fixed reward (wiki: Officer Type A M4 = Forgehammer(s), Type B M4 = Charm Design(s), both include Mythic Conquest Skill Book + Mythic Expedition Skill Manual + resource lines — confirm).
7. **Scaling:** do thresholds/rewards scale by Town Center level / server age / kingdom age (like the prep chart's "milestones scale with your Town Center group"), and what should the page say about unlock age (wiki: "Age of Truegold", War-Academy-gen-4 missions)?
8. **Overlap double-counting:** does Armament double-count with Alliance Brawl / Alliance Mobilization tasks when they share the calendar (wiki claims yes), and does that change the today card's guidance?
9. **Cadence contradiction:** the wiki's "every 2 weeks" (≈2 runs per 28 days) conflicts with the owner's 2× in days 1–7 **and** 2× in days 15–21 (4 per cycle). The proposal encodes the owner's rule — please confirm 4 runs/cycle is intended (and what, if anything, the wiki's cadence refers to).
10. **Guidance stance:** is "take the fixed rewards, skip the rankings" still the alliance line for both events on all runs, or is it run-dependent (e.g. participate when the variant doesn't eat SG/KvK-precious materials)?

**Product/design decisions:**
11. Permanent page name and whether `/kvk-strongest-governor/` is kept (recommendation: rename the *page identity* to Event Cycle now, keep the URL; revisit rename once a site-wide old-URL pattern exists).
12. Identity: do Armament/Officer sections keep the page's campaign-gold signal (recommended — one signal per page) or earn their own accent (needs a DESIGN.md exception)?
13. i18n: start translating the `ks.*` group into the 15 dictionaries when this page leaves BETA, or earlier?
14. Mobile nav: adopt the ❧ Ledger Sheet (Section C-a) and keep the ≥700px `.ev-switch` strip as-is — confirm; and whether `.ev-foot` should later be trimmed once the drawer ships.
15. Home card copy/order confirmation for Event Cycle first (Section B.1 order) — including the hero chips list and whether the ghost card stays "Alliance Championship".

---

*Prepared for the dey.ci maintainers. No files other than this proposal were changed.*
