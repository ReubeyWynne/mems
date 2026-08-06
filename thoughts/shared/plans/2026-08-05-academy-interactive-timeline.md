# Implementation Plan — Academy Interactive Timeline

Source spec: `thoughts/shared/specs/2026-08-05-academy-interactive-timeline.md`
Status: Approved · Decisions: Concept A · spread as a control · extend WavePlanner as shared engine · playerCap default 15

## Execution Mode

6 tasks → **agent orchestration** (implement_task per phase, handoffs in `thoughts/handoffs/academy-timeline/`).

## Risks (Pre-Mortem)

| Risk | Mitigation |
|---|---|
| Engine refactor breaks admin planner | `BuildPlan` signature keeps defaults; new params optional; Phase 1 ends with admin planner smoke test (`/api/admin/planner` renders) |
| SSE rebuild storms from slider drag | Rebuild on `change` (release), not `input`; pure-math readouts via `data-computed` ride the signals instantly |
| SSR initial render vs SSE fragment drift | Single `AcademyTimeline.RenderHtml` used by both (AcademyFormation pattern) |
| Density strip misrepresents simultaneous fires | Cell cap (~4) + "+N" annotation |
| 15-slot default surprises members with real caps | Default applies only when `capAssumed`; real `RallyJoinerCap` overrides |
| Mobile (≤640px) layout regression | Phase 4 includes explicit 640px check of strip transpose + vertical lanes |
| Copy still describes the old hardcoded plan | F13 (copy rewrite) is a Phase 5 task, not an afterthought |

## Phase 1 — Engine: parametric WavePlanner + AcademyTimeline

Files: `BearHunt/WavePlanner.cs`, new `BearHunt/AcademyTimeline.cs`, `BearHunt/DamageCalc.cs` (read-only)

- [ ] `WavePlanner.cs:82`: `playerCap` default 20 → 15 (applies only when `capAssumed`).
- [ ] Add engine inputs: `Spread` (0..1) and `EventLength` (min). `WaveCount` becomes derived from L (min(L, 4) at spread=0; more at spread>0). Keep `WaveCount` const as the *default* for existing callers.
- [ ] Per-lead launch offset: group minute + spread-scaled sub-minute offset (0s at spread 0 → ~40s at spread 1).
- [ ] Add 30-min repeat projection: rounds repeat every `fire + travel` until `launch ≥ EventLength − 5` (last call), preserving the group-4 shorter-travel concept as a parameter, not a hardcode.
- [ ] Add readout computation on the fire timeline: fires/min (mean+max), longest silence, rallies fired, coverage % (minutes 5:00→end with ≥1 fire), parked minutes = `max(0, P×Q − L×S)` share per cycle, capacity vs demand verdict, first fire.
- [ ] New `AcademyTimeline`: `Inputs Parse(query, cycle?, members, prefs)` (prefill vs custom), `Compute(inputs) → Plan(segments, fires, readouts)`, `RenderHtml(plan)` — the static shared-SSR/SSE pattern from `AcademyFormation.cs:1-8`.
- [ ] Acceptance: `dotnet build` clean; `/api/admin/planner` still renders with playerCap 15 in effect.

## Phase 2 — Endpoint

Files: `BearHunt/Endpoints/AcademyEndpoints.cs`, `BearHunt/Program.cs`

- [ ] Add `GET /api/academy/timeline`: Datastar SSE (formation pattern, `AcademyEndpoints.cs:10-22`); reads `Db.Cycles.FindAsync(1)`, `Db.Preferences.ToListAsync()`, `Db.Members.ToListAsync()`; patches `#timeline` fragment via `AcademyTimeline.RenderHtml`.
- [ ] Non-gated (public lesson); wire `AcademyEndpoints.Map(app)` in `Program.cs`.
- [ ] Acceptance: `curl`/browser `?leads=3&participants=20&q=4&spread=1` returns a patched fragment with expected lane count and readouts.

## Phase 3 — Razor: timeline section rewrite

File: `BearHunt/Components/Pages/Academy.razor`

- [ ] One `.tl` frame, one `.tl-ticks` block (delete the duplicated FFA ruler); `--axis` shared.
- [ ] Three-state toggle (Contrast default / Staggered only / FFA only) via existing radio `:checked ~` pattern.
- [ ] Contrast view: ghosted FFA reference band (demoted styles), full-height `.tl-ref-fire` ghost lines, `.tl-density` strip (30 cells, red/green mini-bars, `--h` custom property), parametric staggered lanes (≤8 + pooled "+N leads").
- [ ] Controls panel (`.lesson-form`/`.form-row` look): L (0–100), P (1–300), Q (range 1–6, `#q-slider` pattern), S joiner slots (default 14), event length (10–60), spread slider, source toggle (Real schedule / Custom) emitting Datastar signals; plan rebuild via debounced SSE to `/api/academy/timeline`.
- [ ] Readout strip beside the legend: fires/min, longest silence, rallies fired, parked minutes, capacity vs demand, coverage %, first fire; `data-computed` for pure math, fragment-borne for the rest.
- [ ] Empty/overflow states: L=0 overlay, L=1 honest near-FFA plan, overflow chips; roster panel wired to `.tl-roster` (leads + joiners per group).
- [ ] Remove `BuildStaggered`/`BuildFfa` and their now-dead helper records (`Lead`, `Joiner`, `GroupLane`, `FfaLane`) from `@code`.
- [ ] Acceptance: page renders the Contrast view with real param-driven lanes; toggling views works; sliders rebuild without reload.

## Phase 4 — CSS

File: `BearHunt/wwwroot/components/academy.css`

- [ ] `.tl-ref-fire` full-height ghost lines; ghosted FFA band demotion (opacity, dashed, red-tint).
- [ ] `.tl-density` strip + mini-bar geometry via `--h` (mirror the `--at`/`--from`/`--to` mechanism); cell cap "+N".
- [ ] Three-state `.tl-switch`; controls panel styles (reuse `.lesson-form`); overflow chips.
- [ ] ≤640px media query: density strip transposes to vertical column beside the axis; ghost lines become full-width horizontal; lanes already transpose (verify).
- [ ] Acceptance: visual check at 960px and 400px widths in browser; `prefers-reduced-motion` respected.

## Phase 5 — Copy + admin parity

Files: `BearHunt/Components/Pages/Academy.razor` (caption), `BearHunt/Endpoints/WavePlannerEndpoints.cs`

- [ ] Rewrite `scenario-caption` to describe the parametric plan and readouts; group-4 "5th rally" becomes a note/tooltip, not hardcoded truth.
- [ ] Admin planner output gains the shared readouts (fires/min, coverage, parked) from the same engine.
- [ ] Acceptance: Academy caption matches rendered behavior at default params; admin planner shows readouts.

## Phase 6 — Verification

- [ ] `dotnet build` clean (no warnings introduced).
- [ ] Run the app (hub start), smoke test: Academy page → Contrast view default → toggle all three views → drag L/P/Q/spread → plan + strip + readouts rebuild → extreme inputs: L=0 (empty state), L=1 (≈ FFA), P=200 (overflow chips + parked readout) → source toggle Real schedule (anchors to actual `Cycle` times) → roster expansion → mobile width.
- [ ] Admin planner (`/bear-hunt/admin/planner`) renders with playerCap 15; no regression.
- [ ] Confirm no new JS files; no `.tl-ticks` duplication remains.
- [ ] Manual verification pause before marking plan complete.

## Deferred (P2)

- Playback scrubber (F14). Strip a11y per-cell labels (F15) if time permits.
