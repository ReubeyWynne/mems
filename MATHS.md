# Bear damage maths — extracted from the Frakinator

Source: the **Frakinator** (Streamlit app by [685] Frak, "Bear ratio" / "Bear damage" tabs).
These are the formulas the demystified site (and the old BearHunt app's `DamageCalc`) are pinned to.
Extracted from the app's KaTeX markup on 2026-08-20.

## Notation

| Symbol | Meaning |
|---|---|
| `N_t` | number of troops of type `t` (inf/cav/arc) in *your* march |
| `N_tot` | total squad size of your march (`N_inf + N_cav + N_arc`) |
| `f_t` | fraction of your march of type `t` (`f_inf + f_cav + f_arc = 1`) |
| `A_t` | **attack factor** of the rally *leader* for troop type `t` (theory-craft definition; damage is linear in the leader's attack *and* lethality) |
| `base_att` | base attack stat of the troops you send (tier-dependent) |

## 1. Per-troop-type damage

```
D = (1.2/1000) × √5000 × √N_troops × base_att × A
```

- **A** — attack factor of the rally leader for the troop type considered (theory-craft tab).
- **N_troops** — number of troops of one kind that you are sending.
- **base_att** — base attack of the troops you are sending.
- **(1.2/1000) × √5000** — numerical factor that represents an *effective bear defense and the army size of the bear troops*.

**Total bear damage = sum of the damage done independently by infantry, cavalry and archery.**

Per-troop properties:
- proportional **linearly** to the attack of the rally leader,
- proportional **linearly** to the lethality of the rally leader,
- proportional to **√(number of troops)** of a given type.

> *"Needless to say, this is the most basic formula. Multiplicative contributions from the skills of
> the lead and joining heroes have to be factored in as well."* — i.e. **hero skills multiply on top**:
> the lead's hero skills boost the rally; joining heroes' skills boost their own march.

## 2. Simplified proportional form ("real" unit stats)

With the real unit stats folded in, total damage to the bear is *proportional* to:

```
(1/3)·A_inf·√f_inf  +  A_cav·√f_cav  +  (4/3)·A_arc·√f_arc × 1.1
```

- The **1.1** on the archery term: the bear troops are **full infantry**, and archers do **+10% damage
  to infantry troops**. "There can be an additional 1.1 factor to archer for T>6 and TG3+ troops."
- `f_inf + f_cav + f_arc = 1` (fractions of your march).

## 3. Full damage equation (valid for T6 troops)

```
D = L · [ (1/3)·A_inf·√f_inf  +  A_cav·√f_cav  +  (4.4/3)·A_arc·√f_arc ]
```

with:

```
L = (1.2 × √5000)/1000 × √N_tot × att_cav
```

Notes:
- `(4/3) × 1.1 = 4.4/3` — §2 and §3 are the same archer weight. ✓
- The `att_cav` factor inside `L` looks like a typo or an internal normalisation (the equivalent
  per-type formula in §1 uses `base_att` per type). It is **constant for a given march**, so it
  cancels out of every ratio/optimisation and never affects the split rules.

## 4. Optimal troop split (Lagrange multipliers)

We maximise `D` over the fractions, subject to `f_inf + f_cav + f_arc = 1`. The result:

```
f_inf = α² / (α² + β² + γ²)
f_cav = β² / (α² + β² + γ²)
f_arc = γ² / (α² + β² + γ²)
```

with:

```
α = L·A_inf / 3        β = L·A_cav        γ = (4.4·L·A_arc) / 3
```

`L` cancels out of the ratios, so the optimal mix is:

```
f_t ∝ (base_t·A_t)²   with weights (A_inf/3, A_cav, 4.4·A_arc/3), squared
```

The mix depends **only on the lead's attack factors** — not on your stats, not on march size.

## 5. Optimal damage at the optimal split

```
D* = L · √( (A_inf/3)² + A_cav² + (4.4·A_arc/3)² )
```

This is the "leader strength" `K = √((A_inf/3)² + A_cav² + (4.4·A_arc/3)²)` used to rank rally
leads, times the constant `L`.

## Corrections this implies for the demystified site

1. **Archer weight origin**: it is `(4/3) × 1.1 = 4.4/3 ≈ 1.47`, not "4 × 1.1". The 1.1 is the
   archers' +10%-vs-infantry bonus, and it applies because **the bear is all infantry**.
2. **T7+ / TG3+ archers**: an *additional* ×1.1 → weight 4.84/3 ≈ 1.61. The old site's
   `DamageCalc` comment already flagged this ("flip to 4.84/3 when TG3+ archer bonus lands").
3. **Troop tier matters**: damage is ∝ `base_att` of the troops you send — send your highest tier.
   The site previously said nothing about tiers.
4. **Heroes multiply**: lead's hero skills (whole rally) and joining heroes' skills (their own
   march) are multiplicative on top of A. The site previously implied the leader's stats were the
   only personal factor.
5. **Absolute scale**: the reward brackets (47M / 90M / 175M / 330M / 625M / 1.2B) sit on the full
   scale that includes the bear factor `(1.2/1000)·√5000`, `√N_tot`, `base_att`, and hero boosts.
   The √ / split / fair-share rules are scale-independent and hold regardless.
6. **Nothing changes the relative rules**: doubling a march is still +41%; Q marches are still
   √Q × one march; a full rally at fair share is still √j × a solo carry — because all of those
   are ratios and every constant cancels.

## Verified-consistent items

- Optimal split f_t ∝ (base_t·A_t)² matches the old app's `DamageCalc.TargetRatio`
  (`alpha_i² / Σ alpha_j²` with `alpha = (A_inf/3, A_cav, 4.4·A_arc/3)`).
- Optimal damage `L·√(Σ (base_t·A_t)²)` matches `DamageCalc.LeaderQuality` (`K`).
- No extra 1.1 on archers below T7/TG3 — matches the app's comment.
