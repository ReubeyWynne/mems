# Multi-Event Pages (Vikings Vengeance + Home) — Specification

Date: 2026-08-22 · Status: Approved (decisions locked by user: 3 static pages, home at `/`,
swipe = full-page drag + commit bar, content truth = video transcript, difficulty 1–11)

## Executive Summary

The guide site is a single static page (`index.html`) about Bear Hunt. This change turns it
into a small static site of **event pages** with a **home page** at `/`: the Bear Hunt guide
moves to `bear-hunt.html` (content unchanged), a new **Vikings Vengeance** guide lands at
`vikings-vengeance.html`, and the home page lists the events as selectable cards. Mobile gets
**intentional swipe navigation** — a horizontal drag shows a live preview of the neighbour
event's cover and only navigates on release past a commit bar (or a fast flick); vertical
scrolling is never hijacked. Desktop gets an **event switcher** in the topbar, keyboard
`←`/`→`, and the home cards. Content ships **English-first**; i18n dictionaries are untouched
until the English build is approved and verified, then a separate translation pass adds
`home.*` / `vv.*` keys to all 16 dictionaries.

## Problem Statement

1. **The site is one page.** The Bear Hunt guide owns `/`. There is no room for a second
   event guide, and no navigation at all — the site cannot grow past one event.
2. **Vikings Vengeance has no guide on this site.** The event is a major recurring alliance
   event (governor gear materials) with the same audience as Bear Hunt: alliance members who
   want the plain-words version.
3. **Mobile nav needs to be deliberate.** These are long scrollable documents. Any
   horizontal gesture must never fire by accident while reading — the site needs a
   *preview-then-commit* model, not a carousel.
4. **Desktop has no nav pattern.** A swipe is a touch idiom; desktop needs an explicit,
   discoverable switcher instead.

## Decisions (locked by user)

- **Three static pages**: `index.html` (home), `bear-hunt.html`, `vikings-vengeance.html`.
  No SPA, no build step — the site stays fully readable without JS.
- **Home at `/`**; Bear Hunt moves to `/bear-hunt.html`. Old deep links (`/#sqrt` etc.)
  redirect via a tiny shim on the home page.
- **Swipe model**: full-page horizontal drag with a commit bar (~38% viewport width or a
  fast flick) and a live preview panel of the neighbour event. Past ~14% of the viewport
  the preview springs fully open so its content is readable before the release point;
  short drags spring back. No persistent arrows/handles — the preview itself is the
  affordance (persistent edge tabs were removed after review as mobile noise).
- **Content truth = the video transcript** (StratGameSloth playlist) for the Vikings
  page; difficulty scale is **1–11** (11 hardest). The written kingshotmastery.com guide is
  used only where it does not contradict the transcript (wave table, skill-stacking rules,
  Members-tab workflow). Community reference: kingshotguide.org's Viking Vengeance
  calculator, credited in the footer.
- **English first**: no dictionary changes in this phase. All new copy carries `data-i18n`
  keys (`home.*`, `vv.*`, `ev.*`) so the translation pass is pure dictionary work; missing
  keys fall back to the inline English, which is also the correct fallback in every language.

## Success Criteria

- `/` renders the home page: hero + event cards (Bear Hunt, Vikings Vengeance, "more soon").
- `bear-hunt.html` is byte-identical in content to the old `/` except: canonical/hreflang/og
  URLs, the event switcher in the topbar, the footer event links, and script tags
  (`common.js` + `bear-hunt.js` instead of `app.js`).
- `vikings-vengeance.html` renders the full guide: hero, one-liner, send-everyone-out
  (+ kill-surface toy), troop order (+ composition rows), online waves (+ wave table),
  HQ waves, heroes (+ joiner-lead roster strip), four rules. Difficulty 1–11, no invented maths.
- Old `dey.ci/#model` (and the other nine Bear Hunt section hashes) redirect to
  `bear-hunt.html#model` etc. from the home page.
- Touch: a horizontal drag from anywhere on an event page (not starting on a form control)
  slides the neighbour preview in; past ~14% of the viewport it springs fully open and
  stays readable; release past the bar navigates; short drags spring back; vertical scroll
  works untouched; a flick commits even under the bar.
- Desktop: topbar switcher marks the current page; `←`/`→` navigate between events
  (except when typing in inputs); the home cards navigate.
- `prefers-reduced-motion`: no slide preview — release past the bar still navigates.
- No JS = every page still readable and navigable via links.
- `i18n.js` and all 16 dictionaries untouched; `app.js` retired (logic split into
  `common.js` / `bear-hunt.js` / `vikings.js`).
- The Blazor hub (`BearHunt/`) is untouched.

## Architecture

```
index.html               home — hero + event cards + deep-link redirect shim
bear-hunt.html           the existing guide, moved (data-page="bearhunt")
vikings-vengeance.html   new guide (data-page="vikings")
common.js                shared chrome: progress, TOC scrollspy, front layer, lang
                         picker, event switcher, keyboard, swipe + peek, scroll
                         restore, bear mascot (moment + trophy + typed words),
                         egg machinery (BH.registerPage API)
bear-hunt.js             rally + march calculators, bear whispers/gossip, calc
                         eggs, hedera
vikings.js               kill-surface toy, vikings whispers, toy egg
events.css               switcher, event cards, peek panel, wave
                         table, composition rows, vikings sleet theme
styles.css               unchanged
i18n/*.js                unchanged this phase
```

### Page data attributes (swipe + keyboard)

`<html>` carries `data-page` plus optional `data-prev-url` / `data-next-url` with
`data-prev-title` / `data-next-title` / `data-prev-lede` / `data-next-lede` (inline
English now; becomes `data-i18n-attr` targets in the translation phase).

Order: `home → bear-hunt → vikings-vengeance`.

### Egg bit registry (shared `bh_eggs` localStorage)

| Bits | Owner |
|---|---|
| 0–7 | Bear Hunt whispers |
| 8–11 | Bear Hunt calc eggs |
| 12 | Bear Hunt hedera (rule five) |
| 13–15 | typed words (site-wide) |
| 16 | bear moment / paw trophy (site-wide) |
| 21–26 | Vikings whispers |
| 27 | Vikings kill-surface toy egg |

## Implementation Notes

- **Swipe gesture**: `touchstart/move/end` on the document. Horizontal intent requires
  `|dx| > |dy|` and `|dx| > 10px` before the peek activates; touch starting on
  `input/select/textarea/[contenteditable]` never activates. `html, body` get
  `overscroll-behavior-x: none` so iOS edge-swipe can't fight the peek; a global
  `touch-action: pan-y` is deliberately avoided because it intersects down the tree
  and would break the calculators' range sliders. Before the open threshold the
  preview follows the finger with slight resistance and main content parallaxes;
  past `OPEN_FRAC` (0.14 × viewport) the panel springs fully open (`translateX(0)` +
  `.snap`) and stays open while the finger is down, so the content is readable well
  before the release point. Commit = `|dx| > COMMIT_FRAC` (0.38 × viewport) or a
  flick (`|dx| > 60px` in < 250ms); short drags spring back via a `.snap` class
  added in common.js.
- **No persistent affordances**: the always-visible edge tabs were removed after
  review (mobile noise); the preview panel that appears on drag is the only
  gesture feedback.
- **Scroll restore**: `sessionStorage["bh_scroll_" + data-page]` saved on `pagehide`,
  restored on load when there is no location hash.
- **Switcher**: `.ev-switch` sits between brand and lang-picker in the topbar, hidden
  below 700px; the footer carries the same three links (mobile explicit fallback).
- **Vikings theme**: same tokens and amber signal; only the `.dust` particle layers
  change to drifting sleet (three faint dot layers drifting very slowly — the streak
  grid was removed after review as a flickering grid) via
  `html[data-page="vikings"]` overrides.
- **No invented maths**: the kill-surface toy labels its output honestly ("garrisons
  scoring for you") and carries a note that there is no published formula — per-wave
  points depend on garrison share.

## Translation Phase (separate, after English approval)

- Add `home.*`, `vv.*`, `ev.*` keys (plus per-page `meta.*` variants) to `en.js`; mirror
  `bear-hunt.html`'s existing chrome keys where shared.
- AI-pass across all 16 dictionaries; flag for native review (TRANSLATION_REVIEW.md flow).
- Swipe peek labels become `data-i18n-attr` targets; page files rebuild whisper strings
  from dictionaries on `i18n:change`.

## Future Options (not in scope)

- Bottom tab bar on mobile as an explicit nav tier above the footer links.
- More event pages (Swordland Showdown, Alliance Championship) — the home grid and
  switcher are built to grow; order becomes `home → bear-hunt → vikings → …`.
