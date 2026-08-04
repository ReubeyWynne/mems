using System.Globalization;
using BearHunt.Models;
using Microsoft.AspNetCore.Http;

namespace BearHunt;

/// <summary>
/// Shared logic for the Academy "Your Formation" section: parses form inputs
/// (query params / Datastar signals), computes the leader mix with DamageCalc,
/// and renders the output HTML. Used by both the SSR page and the
/// /api/academy/formation Datastar endpoint so they cannot drift apart.
/// </summary>
public static class AcademyFormation
{
    public const double ExampleA = 9.205; // balanced sample leader: (1 + 250/100)(1 + 163/100)
    public const int MaxSimultaneous = 6; // most simultaneous rallies a player can field (MarchCount)

    public sealed record Inputs(
        string Leader = "custom",
        int? InfAtk = null, int? InfLet = null,
        int? CavAtk = null, int? CavLet = null,
        int? ArcAtk = null, int? ArcLet = null,
        int Inf = 600_000, int Cav = 400_000, int Arc = 100_000,
        int Q = 6, int Cap = 25_000);

    public sealed record Result(
        double RInf, double RCav, double RArc,
        int RecInf, int RecCav, int RecArc,
        int Cap, int Q,
        double PerMarchDmg, double TotalDmg,
        bool ArcherScarce);

    public static Inputs Parse(IQueryCollection q, Member? viewer)
    {
        int? Get(string key) => int.TryParse(q[key].FirstOrDefault(), out var n) ? n : null;

        int inf = Get("inf") ?? (viewer is { Infantry: > 0 } ? viewer.Infantry : 600_000);
        int cav = Get("cav") ?? (viewer is { Cavalry: > 0 } ? viewer.Cavalry : 400_000);
        int arc = Get("arc") ?? (viewer is { Archers: > 0 } ? viewer.Archers : 100_000);
        int q0 = Get("q") ?? (viewer is { MarchCount: > 0 } ? viewer.MarchCount : 6);
        if (q0 < 1) q0 = 1; else if (q0 > MaxSimultaneous) q0 = MaxSimultaneous;

        return new Inputs(
            Leader: q["leader"].FirstOrDefault() ?? "custom",
            InfAtk: Get("infAtk"), InfLet: Get("infLet"),
            CavAtk: Get("cavAtk"), CavLet: Get("cavLet"),
            ArcAtk: Get("arcAtk"), ArcLet: Get("arcLet"),
            Inf: inf, Cav: cav, Arc: arc,
            Q: q0, Cap: Get("cap") ?? 25_000);
    }

    public static Result Compute(Inputs i, IReadOnlyList<Member> members)
    {
        // custom stats apply only when the Custom stats leader is selected
        bool anyCustom = i.InfAtk.HasValue || i.InfLet.HasValue || i.CavAtk.HasValue
                      || i.CavLet.HasValue || i.ArcAtk.HasValue || i.ArcLet.HasValue;
        bool customFilled = i.Leader == "custom" && anyCustom;

        double aInf, aCav, aArc;
        if (customFilled)
        {
            aInf = DamageCalc.AttackFactor(i.InfAtk, i.InfLet);
            aCav = DamageCalc.AttackFactor(i.CavAtk, i.CavLet);
            aArc = DamageCalc.AttackFactor(i.ArcAtk, i.ArcLet);
            if (aInf + aCav + aArc == 0) aInf = aCav = aArc = ExampleA; // placeholders only, no real stats yet
        }
        else
        {
            var pick = members.FirstOrDefault(m => m.Username == i.Leader && CompleteStats(m));
            if (pick is not null)
            {
                aInf = DamageCalc.AttackFactor(pick.InfantryAtkPct, pick.InfantryLethalityPct);
                aCav = DamageCalc.AttackFactor(pick.CavalryAtkPct, pick.CavalryLethalityPct);
                aArc = DamageCalc.AttackFactor(pick.ArcherAtkPct, pick.ArcherLethalityPct);
            }
            else
            {
                aInf = aCav = aArc = ExampleA;
            }
        }

        var (rInf, rCav, rArc) = DamageCalc.TargetRatio(aInf, aCav, aArc);
        var (recInf, recCav, recArc) = DamageCalc.RecommendMarch(i.Inf, i.Cav, i.Arc, i.Q, i.Cap, rInf, rCav, rArc);
        double perMarch = DamageCalc.MarchDamage(aInf, aCav, aArc, recInf, recCav, recArc);

        int aI = i.Inf / i.Q, aC = i.Cav / i.Q, aA = i.Arc / i.Q;
        bool archerScarce = aA < rArc * (aI + aC + aA);

        return new Result(rInf, rCav, rArc, recInf, recCav, recArc, i.Cap, i.Q, perMarch, perMarch * i.Q, archerScarce);
    }

    /// <summary>Markup for the <c>#formation-output</c> section (SSR and SSE fragment share this).</summary>
    public static string RenderHtml(Result r)
    {
        var inv = CultureInfo.InvariantCulture;
        var sb = new System.Text.StringBuilder();
        sb.Append("""<h3>Your leader's preferred mix</h3>""");
        sb.Append($"""<p class="lesson-math"><strong>{r.RInf.ToString("0.0%", inv)} infantry / {r.RCav.ToString("0.0%", inv)} cavalry / {r.RArc.ToString("0.0%", inv)} archers</strong></p>""");
        sb.Append("""<p>Archers hit hardest per troop, so they always get the biggest share.</p>""");
        sb.Append("""<div class="lesson-fact">""");
        sb.Append(r.ArcherScarce
            ? """You don't have enough archers for that mix. Send all your archers, 5k infantry, and fill the rest with cavalry."""
            : """Your troops fit the mix. Scale each type to match the leader's share.""");
        sb.Append("""</div>""");
        sb.Append("""<h3>Send this per march</h3>""");
        sb.Append($"""<p class="lesson-math"><strong>{Templates.FmtK(r.RecInf)} infantry / {Templates.FmtK(r.RecCav)} cavalry / {Templates.FmtK(r.RecArc)} archers</strong>""");
        sb.Append($"""&nbsp;(cap {(r.Cap <= 0 ? "uncapped" : Templates.FmtK(r.Cap))}, {r.Q} simultaneous rallies)</p>""");
        sb.Append($"""<p>Each march scores about {r.PerMarchDmg.ToString("N0", inv)}; all {r.Q} simultaneous rallies together &asymp; <strong>{r.TotalDmg.ToString("N0", inv)}</strong>. (Scores are for comparing setups. Not real damage numbers.)</p>""");
        return sb.ToString();
    }

    static bool CompleteStats(Member m) =>
        m.InfantryAtkPct.HasValue && m.InfantryLethalityPct.HasValue
        && m.CavalryAtkPct.HasValue && m.CavalryLethalityPct.HasValue
        && m.ArcherAtkPct.HasValue && m.ArcherLethalityPct.HasValue;
}
