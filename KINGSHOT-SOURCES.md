# KingShot sources — the Frakinator's acknowledgements, mined

Working reference mined from the four sources the Frakinator credits
(fetched/cloned **2026-09-10**; every claim below was read from the source or its
checked copy — nothing second-hand). Use it for the **battle simulator**, the
**bear hunt** page, the **other event pages** (KvK prep / SG / Vikings / Swordland),
and general future agent work. Where a number is community-claimed or needs an
in-game check it is marked `⚠ verify`.

`MATHS.md` stays the formula source of truth for what dey.ci publishes; this file
records *where the underlying engine facts come from* and the KingShot-specific
extras the sources contain.

---

## The four sources at a glance

| Source | What it is | Limits for us |
|---|---|---|
| [kingshotsimulator.com](https://kingshotsimulator.com) | KingShot battle-sim SPA (React + Chakra). Pages: battle, bear-simulator, bear-formation-helper, bear-joiner-helper, lovelorn-formation-helper, troop-base-stats. | **All combat math is server-side** (private API) — the client bundle holds only input models + data. Formulas, bear HP/def-by-level and reward brackets are **not** in the bundle. |
| [sos-guide-en](https://sites.google.com/view/sos-guide-en) | "State of Survival Ultimate Guide EN" — SoS is the Century-Games engine KingShot reuses. Fight-mechanics pages are the mechanics bible. Mirror `en.ultimate-guide.ovh` was **down** on fetch date; Google Sites originals read instead. | SoS vocabulary, not KingShot's; some formulas live in images (worked examples re-derived). |
| [request-laurent/sos.battle](https://github.com/request-laurent/sos.battle) | The SoS battle simulator (Java) behind the guide. Author claims **>99% battle reproduction** (states < #409, new engine). Holds `unit_stats.json` + the kill-formula code. | This snapshot has **no T12** (max T11). Engine is a documented simplification (only 4 unit fields consumed). |
| [nchanko/myanocr_pub](https://github.com/nchanko/myanocr_pub) | OCR wrapper (Cloud Vision / Tesseract) the Frakinator used to read battle-report screenshots. | **GPL-2.0, zero stat parsing.** Not a dey.ci dependency — see the OCR note. |

Evidence copies: `.scratch/sources/sos.battle/`, `.scratch/sources/myanocr_pub/`,
`.scratch/kingshot-sim/assets/` (original bundles) and
`.scratch/kingshot-sim/main.pretty.js` (un-minified copy; line refs below point
there).

---

## 1 · Engine canon — what the sources agree on

### Unit base stats (two independent datasets agree)

- Troop types: infantry / cavalry / archers (SoS: Shields/Riders/Hunters; sim UI
  "Infantry/Cavalry/Archer"; sim internal `inf/lanc/mark`).
- **Attack ratio inf : cav : arc = 1 : 3 : 4 exactly, per tier** (T1 TG0
  63 : 189 : 252; T10 TG0 472 : 1416 : 1888).
- **Defense and Lethality are constant 10 for every player troop, every tier.**
  (In the SoS JSON the field is `Defense` + `Damage`; `Damage` is the *lethality
  base*. KingShot sim prose: "Defense and Lethality stay fixed at 10 for all troop
  levels, while only Health and Attack change.")
- **Health mirrors attack** so `Attack × Health` is constant across the three types
  per tier: infantry H ≈ 3×A (T1 189), cavalry H = A_inf (T1 63), archers H ≈ ¾·A_inf
  (T1 47). This mirror is the origin of the site's per-type weights — see §3.
- Tiers run **1–11 only**; no T12 in either dataset. KingShot sim adds a **TG
  (Tier-Group) sub-row 0–5** per tier → 198 rows (66 per type). SoS has matching
  `_1…_5` upgrade variants of each troop family.
- Representative exact rows (atk / def / leth / hp): infantry T1 TG0 `63 10 10 189`,
  T6 TG0 `243 10 10 730`, T11 TG5 `716 10 10 2148`; cavalry T6 TG0 `730 10 10 243`;
  archers T6 TG0 `974 10 10 183`, T11 TG5 `2865 10 10 493`.
- Full tables: `unit_stats.json` (SoS) and the `tMt` template in the sim bundle
  (`main.pretty.js` ~52960; parser at ~53050, header Type/Tier/TG/Attack/Defense/
  Lethality/Health).

### Kill / damage law (SoS engine `Fight.java` — the confirmed model)

- Engaged-troop law: `army = √(N_unit) × √(min(total armies of the two sides))` —
  the "no room for everyone" rule (100k vs 10k → √(10⁵·10⁴) ≈ 31.6k fight).
- Attack factor: `A = Attack·(1+attack%)·Damage·(1+lethality%)/100`
  — i.e. **attack × lethality**, with the 10 base cancelling out.
- Defense factor: `D = Health·(1+health%)·Defense·(1+defense%)/100`
  — i.e. **health × defense**.
- Dead per round: `ceil( army × A/D / 100 × (1 − 0.0001·round) )` — the `0.01%/round`
  fatigue term. With the 10/10 cancelling, kills ∝ attacker Attack / defender Health.
- **Deterministic** — same battle twice, same result (no RNG per fight).
- Targeting: front line infantry → cavalry → archers each round, both sides
  simultaneous; bikers (cav T-class) and snipers (arc T-class) retarget every 20
  rounds; infantry is "4× more resistance". Wounded die at end of round.
- Wounded/dead splits are per battle type (`battle_wounded.json`): e.g. city attack
  wound 10% / light-wound 55%; monster attack wound 0.2% / light 99.8%. Hospital
  full → wounded die.

### Skill vocabulary (SoS `survivor_slg_effect.json` + `Skill.java`)

- Effect ids: 101 extra damage · 201/211/221 damage+ · 202/302 defense-up (incoming
  reduction) · 301 damage dealt/taken debuff · 801 shield · 901 heal.
- Effect targets: own troop type / all own types / multi-continue / all.
- Report labels (effect → line): 101 harm · 801 shield · 901 heal · 302/202 hurt- ·
  201/211/221 damage+.
- **Scope:** a hero's skills apply to that hero's own march. SoS rally joiners
  contribute only a small defense-only share (`302`, ≈ 0.36×benefit, on infantry) —
  **do not transplant that to the bear model**; dey.ci's tested rule ("joiner's
  first skill boosts their own march") stands for Bear Hunt.
- Report stat lines (`sos_en.properties`) match KingShot report grammar: per-type
  Attack/Defense/Health/Lethality, Damage, Damage Received, Crit Lv., Resilience,
  March Capacity, Rally Capacity.

---

## 2 · KingShot-specific extras (simulator bundle, `main.pretty.js`)

### Troop table & provenance

- The sim's own methodology note: in-game troop stats shown to players are
  "placeholders"; the real base stats "come from a similar game called State of
  Survival (SoS) and were shared online… battle mechanics and base troop stats are
  almost the same in both games." → same provenance as MATHS.md §6.2.

### Bear Trap (= the bear event) — naming, corrected 2026-09-10 (owner)

- **"Bear Hunt" is the event; "Bear Trap" is the map object that spawns the bear.**
  Each alliance can run **2 mutually exclusive traps**; a player joins **one of
  them every 48 hours** (matches the bear page's "every 48 hours" chip). The
  sim's "Bear Trap" naming refers to the map object, not a different event.
- Server call payload: `{fighter, bearTrapLevel, valoraTalentLevel, num_sims}`;
  response is average damage only. **Bear Trap Level dropdown = 0–5 (6 levels).**
- **Valora "Hunter Instinct" talent** (added 2026-08-08): ladder L0–11 →
  `0 2 4 6 9 12 15 18 21 24 27 30` = **+30% damage points at L11**. ⚠ A KingShot
  bear knob dey.ci does not yet name anywhere.
- **Enemy-down buffs "do not apply vs Bear Trap"** — only your own-side attack/
  lethality/health/defense buffs help. Corroborates "defence does nothing to a bear"
  on the bear page.
- Reward brackets / Forgehammer table: **not in the bundle** (server-side). Keep
  pinned to the Frakinator.

### Formation helpers (bear + lovelorn — same optimizer)

- Both POST to `bear/suggest-formation` with an identical config: step 0.01,
  ≤80 candidates, 80 sims/candidate, bayes optimizer, "steadiest" selection
  (z 1.8, margin 0.8%), top 8, `bearTrapLevel` hard-coded 5.
- **Search window: infantry 1–20%, cavalry/lancers 5–50%, archers = remainder.**
  dey.ci's taught 10/10/80 sits inside that window — consistent with the site's own
  caveat that 10/10/80 is a doable near-optimum, not the exact optimum.

### Bear joiner helper

- `joiner_slots: 4` split between **Chenko and Amane only**, each **skill 1 at
  level 5** (their bear-damage skills); 200 sims/candidate, top 5; returns
  predicted damage + std-dev. Directly corroborates the bear page's joiner model
  (first skill only; Chenko/Amane S-tier; Yeonwoo same code).

### Special-bonus stacking — the one explicit formula the sim publishes

Verbatim rule the game uses (also blog "how-special-bonuses-work"):

```
(100 + entered%) × (1 + own extras / 100) ÷ (1 + enemy-down / 100) − 100
```

- Same-stat specials add their percents first, then apply **once**.
- **Enemy-down is a divisor, not a subtraction** (a 20% enemy Attack Down divides
  the boosted value by 1.20).
- Sources: exclusive widgets, battle-pet skills, city buffs/debuffs, appointments.
- This generalises MATHS.md §6.4 (widgets are multiplicative); the enemy-down-as-
  divisor phrasing is the part to keep straight in any future copy.

### Buff ladders (exact, from the bundle)

- **Widgets** (hero exclusive gear): % by level L0–5 → `0 5 7.5 10 12.5 15`;
  hero-widget level maps `level ≤ 1 ? 0 : min(5, floor(level/2))`. Roles: **Rally**
  (attacker) and **Defender**; a hero widget applies only in its role.
- **Appointments**: King +5% all stats · Marshal +5% attack · Field Commander +10%
  lethality; Kingdom-of-Power offices: High King +7.5% all · Field Commander +15%
  lethality · Marshal +8% attack. (KvK-prep copy currently names Chief Minister —
  its office id/buff was not in the mined rows; `⚠ verify` before quoting numbers.)
- **Battle pets** (own side): Alpha Black Panther (troop lethality) · Giant Rhino
  (attack) · Regal White Lion (defense) · Ironclad War Elephant (health), percents
  by level `2.5 3 3.5 4 5 6 7 8 9 10` (10 levels). Enemy-down pets: Ironclad War
  Bear (enemy defense, same ladder) · Grizzly Bear (enemy lethality, 8 levels
  `1.5…5`) · Moose (enemy health, 7 levels `1.5…5`) — enemy-down pets do **not**
  apply vs the bear.
- **City buffs/debuffs**: each of attack/defense/lethality/health plus enemy
  variants; level I = +10%, level II = +20%.

### Hero roster & skills

- 34 heroes, sharing names with dey.ci's generations (Chenko, Amane, Yeonwoo, Saul,
  Hilde, Zoe, Petra, Marlin, Rosa, Margot, Alcar, Vivian, Ava, Wee&Woo, …).
- Per-hero: 3 skills (skill_num, name, description with %, troop type) + an
  exclusive-widget definition `{troop_type, widget_type: defender|rally,
  widget_effect: attack|defense|lethality|health}`.
- The sim's accuracy claims (~98% battles; Gen-6 ~95%) are community claims,
  consistent in spirit with the Frakinator's "tested = confident" posture.

### Private endpoints (informational — not ours, do not build on)

- Battle & sim: `https://api.srv.kingshotsimulator.com/` (`battle`, `bear`,
  `bear/suggest-formation`, `bear/suggest-joiners`), job-queued.
- Screenshot OCR parser: `https://stats-parser.srv.kingshotsimulator.com/api/v1/
  read_battle_report` and `read_bonus_overview` — they solve the same problem
  dey.ci solves client-side (see OCR note); both endpoints are private services.

---

## 3 · Relevance per page

### Bear Hunt page

- **Confirms** MATHS.md §6.2's base-stat relations with exact numbers: attack
  `1:3:4`, defense = lethality = 10, and the health mirror. The T6 weights
  (⅓, 1, 4.4/3) follow from those numbers; the archer **×1.1 vs-infantry** is an
  in-game bonus **not present in the raw base stats** — it stays a Frakinator/
  community claim (`⚠ verify` if ever re-derived), with the T7+/TG3+ second ×1.1
  note unchanged.
- No T12 anywhere → the site's T11 top-tier framing and KvK troop tables stand.
- Enemy-down buffs don't touch the bear; own-side attack/lethality buffs do
  (useful if the page ever explains pets/widgets).
- Reward-bracket table (47M → 38.4B doubling, +1 Forgehammer per bracket): only
  Frakinator-sourced; the sim does not expose it.
- The 15-player rally model (1 lead + 14 joiners, fair share) is dey.ci's own
  tested model. SoS's "legion = sum of participants, ≤4 participant skills
  modelled" and the sim's 4-joiner-slots abstraction are different structures —
  do not silently cross-import.

### Battle Simulator page (`battle-simulator/`, `js/sim.js`)

- The page's ratio maths (MATHS.md §4–5: `f_t ∝ (w·A)²`, `K = √Σ`) is corroborated
  by the SoS engine's A/D factor structure.
- Engine facts above (√ law, A/D factors, targeting, wounded splits, skill ids) are
  the reference for any future full-damage / PvP / hero-inclusive sim work — with
  the standing caveat that KingShot may differ from SoS where untested.
- Troop base stats (incl. TG sub-rows) are in two places if the sim ever needs a
  tier/TG selector: `unit_stats.json` and the sim bundle table.
- **OCR decision recorded:** the page already ships dey.ci's **own** OCR —
  client-side PaddleOCR.js (PP-OCRv6 tiny), models self-hosted at `/models/`
  (`det-v6-tiny.tar`, `rec-v6-tiny.tar`; upstream Baidu CORS is broken so the
  models can't be hotlinked), engine lazy-loaded from jsdelivr
  (`@paddleocr/paddleocr-js@0.4.2`), 12 Bonus-Details values mapped by row label
  + column (left = your green value). The form stays the source of truth. This is
  deliberately preferred over the Frakinator's approach — see OCR note below.

### KvK prep / SG / Vikings / Swordland pages

- KvK-prep buff ritual: exact kingdom-office numbers (King/Marshal/Field
  Commander; KvK High King/Field Commander/Marshal) and city-buff I/II live in the
  bundle if the ritual ever wants concrete percents. ⚠ Chief Minister's own buff
  still needs an in-game read.
- Wounded/dead split tables and hospital-saturation mechanics (SoS `battle_wounded`
  + the-battle-results) are context for Vikings garrison copy if ever quantified —
  remember the splits are SoS-typed, not KingShot-verified.
- SoS's vs-infected optimal ratio (~50/25/25, keep 60/20/20 if at risk) is **not**
  transferable to the bear (archer-heavy) — do not import into bear copy.
- Duel/SG/KvK point tables and event-cycle facts: unaffected by these sources.

---

## 4 · OCR provenance & the dey.ci decision

- The Frakinator's OCR was the generic myanocr wrapper: two thin functions
  (Google Cloud Vision `text_detection`, or Tesseract via pytesseract, eng+mya),
  returning raw concatenated text with **zero stat parsing** — every
  attack/defense/lethality/health value it displays was parsed by code written on
  top of that. It is **GPL-2.0**; vendoring it would bind any derivative.
- dey.ci's own solution — client-side PaddleOCR.js in `js/sim.js` — is the
  preferred path (static-site-native, no server, box-coordinate mapping, models
  self-hosted). Recorded so future agents do not "improve" the OCR by pulling in
  myanocr or the sim's private parser. Reuse from myanocr: nothing (its two API
  calls are trivial to write fresh if a second engine is ever wanted; Cloud Vision
  returns word boxes that would help cropping, but adds a credential dependency).

---

## 5 · Evidence & re-fetch

- `.scratch/kingshot-sim/assets/` — the 8 JS bundles (names: `react-…js`,
  `chakra-…js`, `icons-…js`, `state-…js`, `form-…js`, `validation-…js`,
  `analytics-…js`, `main-CpM4cTBa.js`) as served 2026-09-10; `main.pretty.js` is
  the un-minified copy (55k lines) all line refs here use.
- `.scratch/sources/sos.battle/` — Java engine + `src/main/resources/asset/*.json`
  (unit_stats, survivor skills, battle_wounded, benefits).
- `.scratch/sources/myanocr_pub/` — the OCR wrapper (small; read fully).
- sos-guide-en pages read (Google Sites): `/fights/battle-mechanics`,
  `/fights/battle-simulator`, `/fights/the-battle-results`, `/fights/units`,
  `/fights/unit-ratios`, `/heros/heroes-description`. Mirror `en.ultimate-guide.ovh`
  was unreachable on fetch date — re-check before citing it.
- Re-fetch the sim bundle: request `https://kingshotsimulator.com/`, take the
  `assets/*.js` URLs from the script tags, un-minify `main-CpM4cTBa.js` with a
  beautifier, then grep the markers above (`tMt`, `Xg`, `yHt`, `howto.*`,
  `special`).
- Agent mining transcripts are ephemeral; this file is the durable record.
