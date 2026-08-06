# Academy Interactive Timeline — Specification

Date: 2026-08-05 · Status: Approved (decisions locked by user)

## Executive Summary

The Academy "Bear Strategies" lesson teaches staggered bear-rally launches by drawing a hardcoded 5-group plan and a free-for-all baseline as two *separately toggled* timelines with separate rulers. The contrast the lesson is about — FFA's 4½-minute silences vs staggered's continuous fires — is invisible because the two plans never share a clock. This change makes the staggered plan a **pure function of (rally leads L, participants P, queues Q, joiner slots S)** with a **spread control** for launch granularity, renders both plans on **one shared 0–30 ruler** with a **per-minute fire-density strip**, optionally **prefills from the real schedule** (trap times, signups, leads), and **reuses the WavePlanner engine** so the Academy and the admin planner can never drift.

## Problem Statement

1. **The comparison doesn't land.** FFA and staggered each render their own `.tl` frame with duplicate tick rulers; the radio toggle hides one entirely (`academy.css` `.tl-view-ffa { display:none }`). The lesson's key claim — fires every minute vs 4½-min gaps — must currently be read from prose, not seen.
2. **The plan is arbitrary and static.** `BuildStaggered()` hardcodes 5 groups, 3 leads each, 1-minute offsets, seeded joiners, and a special-cased "group 4 sub-20s travel" quirk (`Academy.razor:359-420`). It cannot answer "what if we have 4 leads" or "what if 30 people sign up".
3. **Two models already drift.** `WavePlanner` (admin) is a fixed-4-wave, real-data engine; the Academy timeline is a separate illustrative model. `WavePlanner` defaults `playerCap` to **20** (`WavePlanner.cs:82`); Academy copy claims **15** slots (`Academy.razor:194`). There is no site-wide slot constant.
4. **Today's hardcoded plan is measurably imperfect** — a smoothing analysis shows real fire gaps at ~15:00 and ~21:30. A parametric generator with a spread control can do better and show the residual honestly.

## Success Criteria

- One `.tl-ticks` block renders once; both plans position against the same `--axis`.
- Default view is "Contrast": ghosted FFA band + full-height ghost fire lines + fire-density strip + staggered lanes. The gap-vs-continuous contrast is readable as a shape in <2s.
- The plan is a pure function of `(L, P, Q, S, eventLength, spread)`; changing any control rebuilds it without a page reload.
- Extreme inputs degrade honestly: L=0 → empty state ("no leads → no fires"); L=1 → plan visibly ≈ FFA; `P×Q > L×S` → overflow chips + parked readout; no nonsense lanes ever.
- Prefill mode anchors real trap times and real signup counts; custom mode ignores them. Same generator both ways.
- `WavePlanner` playerCap default is 15; the admin planner still works and shows the same readouts.
- ≤640px: timeline transposes vertical; density strip transposes; no layout breakage.
- No new hand-rolled JS. All interactivity via Datastar signals + SSE fragments (existing patterns).

## User Personas

- **Alliance officer / rally organizer** — reads the Academy before a bear trap; wants a plan that matches *their* alliance (how many leads they actually have, how many will show up) and to understand *why* staggering beats FFA.
- **Curious member** — skims the lesson; the density strip must teach without reading.
- **Admin** — runs `/bear-hunt/admin/planner`; benefits from the engine gaining parametric power and real readouts.

## User Journey

1. Officer opens Academy → Bear Strategies. Sees the **Contrast** view by default: FFA band (red, ghosted) on top, density strip in the middle, staggered lanes below, one ruler.
2. The strip reads instantly: FFA = 4 spikes with long gaps; staggered = near-solid coverage 5:00→20:00.
3. Officer drags **Participants** and **Leads** to their real numbers. The plan and strip rebuild (SSE).
4. Officer flips the **spread** slider: same-minute group launches vs sub-minute smoothed fires. The strip's max-bar height drops and gaps close.
5. Officer toggles **Real schedule**: the plan snaps to their alliance's actual trap times and signups; readouts update.
6. Officer expands a group's roster panel to see which leads fire when.
7. Officer walks away with the plan; no spreadsheet.

## Functional Requirements

### Must Have (P0)

- **F1 — One ruler.** Render ticks, minor ticks, and the last-call zone exactly once; both plans share `--axis`. Removes today's duplicated `.tl-ticks` blocks.
- **F2 — Contrast view.** Single `.tl` frame: ghosted FFA reference lane (launch, dashed waiting, fight+travel, parked chips), full-height ghost fire lines at FFA fire instants, per-minute fire-density strip (red = FFA fires/min, green = staggered fires/min, height = count/max, cap with "+N"), parametric staggered lanes (≤8 visible + pooled "+N leads" lane).
- **F3 — Three-state view toggle.** Existing radio pattern extended: Contrast (default) / Staggered only / FFA only.
- **F4 — Parametric generator.** `Plan = f(L, P, Q, S, eventLength, spread)` implemented in the shared engine (see F10). L drives lane count and fire density; capacity `L×S` vs demand `P×Q` decides join windows vs overflow chips.
- **F5 — Controls panel.** Rally leads (0–100), participants (1–300), Q (range 1–6, existing `#q-slider` pattern), joiner slots S (default 14; lead + 14 = 15), event length (10–60, default 30), spread (same-minute → sub-minute smoothing), source toggle (Real schedule / Custom).
- **F6 — Live readouts.** fires/min (mean + max), longest silence, rallies fired per event (staggered vs FFA), minutes parked per participant, capacity vs demand verdict ("fits"/"overflow"), coverage % of minutes 5:00→end with ≥1 fire, first fire (shown deliberately: non-differentiator). Pure-math readouts update via `data-computed`; plan-derived ones arrive with the SSE fragment.
- **F7 — Honest degradation.** Enforced in the generator, not CSS: L=0 empty state; L=1 draws exactly (≈ FFA); overflow → chips + parked readout; lanes pooled at 8.
- **F8 — Prefill from real schedule.** New endpoint reads `Cycle` (Trap1Time/Trap2Time anchors), `Preferences` (signups incl. `IsRallyLead`, `SelectedTrap`), `Members` (stats → K, `MarchCount` → Q, `RallyJoinerCap`/`RallySize` → S). Custom mode = typed inputs.
- **F9 — Slot default fix.** `WavePlanner` `playerCap` default 20 → 15. Applies only when `capAssumed` (real `RallyJoinerCap` still wins).
- **F10 — Shared engine.** `WavePlanner` gains parametric wave count, per-lead launch offsets (spread), a 30-min repeat projection, and readout computation. `AcademyTimeline` is a thin Parse/Compute/RenderHtml wrapper (AcademyFormation pattern) so SSR and SSE cannot drift. Admin planner renders the same engine.

### Should Have (P1)

- **F11 — Roster panel.** Wire the orphaned `.tl-roster`/`.tl-group` CSS (`academy.css:377-438`) as a per-group expansion listing leads (name, K) and joiners.
- **F12 — Admin planner parity.** `/api/admin/planner` output gains the same readouts (fires/min, coverage, parked).
- **F13 — Copy rewrite.** `scenario-caption` text rewritten to describe the parametric plan and what the readouts mean; keep the group-4 "5th rally" story as a tooltip/note, not hardcoded truth.

### Nice to Have (P2)

- **F14 — Playback scrubber.** A playhead that walks the event and highlights live segments (marching/fighting/parked). Deferred; the strip already carries the static story.
- **F15 — Strip a11y.** Per-cell `aria-label="MM:SS — N fires (FFA), M fires (staggered)"`.

## Technical Architecture

### Components

- **`WavePlanner` (extended)** — pure, DB-free engine. New inputs: `Spread`, `EventLength`; `WaveCount` becomes derived; per-lead launch offset = group minute + spread-scaled offset; new `Readouts` record computed from the fire timeline; `BuildPlan` keeps its signature (params with defaults) so existing callers compile unchanged. `playerCap` default → 15.
- **`AcademyTimeline` (new)** — `Inputs Parse(IQueryCollection, Cycle?, members, prefs)` · `Plan Compute(Inputs)` · `string RenderHtml(Plan)` — the formation pattern exactly (`AcademyFormation.cs:1-8`), guaranteeing SSR page and SSE fragment render identically.
- **`AcademyEndpoints` (+1 route)** — `GET /api/academy/timeline`: Datastar SSE, reads `Cycle`/`Preferences`/`Members`, `sse.PatchElementsAsync` a `#timeline` fragment (pattern: `AcademyEndpoints.cs:10-22`). Non-gated like `/api/academy/formation`. Wired in `Program.cs`.
- **`Academy.razor`** — timeline section rewrite: one `.tl` frame, one tick block, ghost FFA band, density strip, pooled lanes, controls panel, readout strip, roster panel, empty/overflow states.
- **`academy.css`** — new `.tl-ref-fire` (full-height ghost lines), `.tl-density` (strip + bars via `--h` custom property), ghost-band demotion styles, 3-state `.tl-switch`, overflow chips; ≤640px transpose for strip + ghost lines; `.tl-roster` wiring (styles exist).

### Data Model

- No schema changes. Reads: `Cycle` (singleton), `Preference` (Username, SelectedTrap, IsRallyLead), `Member` (stats, MarchCount, RallySize, RallyJoinerCap). All already accessible from Academy routes.

### Integrations & Security

- Reuses `RazorRenderer`, `AuthHelper.GetUsername`, Datastar bundle + `data-tip`/`data-intl-time` plugins (`MainLayout.razor:103-105`). No new JS files.
- Endpoint is read-only and public (lesson content); exposure = usernames + stat-derived K, already public on the Academy leader select. No writes. Admin planner route stays admin-gated.

## Non-Functional Requirements

- **Client complexity:** zero hand-rolled JS; Datastar signals + SSE only.
- **Rebuild latency:** slider rebuilds fire on `change` (release), not `input`; endpoint reads are small (1 cycle row, prefs, members) — same cost class as existing `/api/schedule`.
- **A11y:** radio group keeps `role="radiogroup"`/`aria-label`; density cells get aria-labels; tooltips stay native Popover via `data-tip`.
- **Mobile:** ≤640px transpose preserved for lanes; strip transposes to a vertical column; ghost lines become horizontal full-width lines.

## Out of Scope

- Playback animation/scrubber (P2, deferred).
- Concept B fire-wall chart.
- Changing per-member `RallyJoinerCap`/`RallySize` data or the game's real slot rule.
- Per-member real join assignment in the Academy (aggregate capacity model only; WavePlanner's weakest-first assignment stays the admin planner's job).
- Admin planner UI restyle.

## Open Questions for Implementation

- Spread slider mapping: 0..1 → per-lead offset range (e.g. 0s at 0, up to ~40s at 1). Exact curve at implementation time; must preserve "last rally still fills within its minute" behavior.
- Density cell cap (designer: ~4 fires + "+N"); confirm against default plan (3 fires/min per group minute).
- Prefill Q source: use real `MarchCount` per member or the Q slider value? Recommendation: slider default, real data shown in a hint.

## Appendix: Key Evidence

- `Academy.razor:359-420` — hardcoded `BuildStaggered()`; `:424-436` — `BuildFfa()`.
- `Academy.razor:16-31` — duplicate tick rendering in two `.tl` frames; radio toggle at `:17-23`.
- `WavePlanner.cs:45` — `WaveCount = 4` const; `:82` — `playerCap` default 20; `:99` — round-robin grouping; `:24-26` — DB-free engine.
- `AcademyEndpoints.cs:8-23` — formation endpoint pattern (SSE + shared static).
- `Academy.razor:176-185` — split-slider `data-signals`/`data-bind`/`data-computed` pattern.
- `academy.css:160-167` — `.tl` grid (`--lanes × 58px`); `:607-691` — ≤640px vertical transpose; `:377-438` — orphaned `.tl-roster` styles.
- `tooltip.js` — `data-tip` Popover plugin; no other Academy JS exists.
