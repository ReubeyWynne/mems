namespace BearHunt;

using BearHunt.Models;

public static class DamageCalc
{
    // Troop type damage coefficients (derived from base attack ratios + archer bonus)
    public const double InfCoeff = 1.0;
    public const double CavCoeff = 3.0;
    public const double ArcCoeff = 4.4;

    // Per-march minimums
    public const int MinPerType = 5000;
    public const int MinTotal = 15000;

    /// <summary>Attack factor: A = (1 + atk%/100) x (1 + let%/100).</summary>
    public static double AttackFactor(int? atkPct, int? letPct)
    {
        if (atkPct is null || letPct is null) return 0;
        return (1.0 + atkPct.Value / 100.0) * (1.0 + letPct.Value / 100.0);
    }

    /// <summary>Optimal troop ratio (fractions summing to 1) for a leader.</summary>
    public static (double Inf, double Cav, double Arc) TargetRatio(
        double aInf, double aCav, double aArc)
    {
        if (aInf <= 0 || aCav <= 0 || aArc <= 0)
            return (0.33, 0.33, 0.34); // fallback: equal split

        var alpha = aInf / 3.0;
        var beta = aCav;
        var gamma = ArcCoeff * aArc / 3.0;

        var alpha2 = alpha * alpha;
        var beta2 = beta * beta;
        var gamma2 = gamma * gamma;
        var denom = alpha2 + beta2 + gamma2;

        return (alpha2 / denom, beta2 / denom, gamma2 / denom);
    }

    /// <summary>Single-march damage from troop counts and leader coefficients.</summary>
    public static double SingleMarchDamage(
        int inf, int cav, int arc, double aInf, double aCav, double aArc)
    {
        return Math.Sqrt(Math.Max(0, inf)) * InfCoeff * aInf
             + Math.Sqrt(Math.Max(0, cav)) * CavCoeff * aCav
             + Math.Sqrt(Math.Max(0, arc)) * ArcCoeff * aArc;
    }

    /// <summary>
    /// Fit available troops to a target ratio, respecting minimums.
    /// Returns (inf, cav, arc, viable). Viable=false if any type &lt; MinPerType or total &lt; MinTotal.
    /// </summary>
    public static (int Inf, int Cav, int Arc, bool Viable) FitToRatio(
        int infAvail, int cavAvail, int arcAvail,
        double rInf, double rCav, double rArc)
    {
        if (rInf <= 0 || rCav <= 0 || rArc <= 0)
            return (0, 0, 0, false);

        // How many full-ratio sets can we make? Scarcest type is the bottleneck.
        var setsByInf = infAvail / rInf;
        var setsByCav = cavAvail / rCav;
        var setsByArc = arcAvail / rArc;
        var scale = Math.Min(Math.Min(setsByInf, setsByCav), setsByArc);

        var inf = (int)(rInf * scale);
        var cav = (int)(rCav * scale);
        var arc = (int)(rArc * scale);

        var viable = inf >= MinPerType && cav >= MinPerType && arc >= MinPerType
                  && (inf + cav + arc) >= MinTotal;
        return (inf, cav, arc, viable);
    }

    /// <summary>
    /// Find optimal march count k for a member given a leader's target ratio.
    /// Returns (bestK, perMarchInf, perMarchCav, perMarchArc, totalDamage).
    /// </summary>
    public static (int BestK, int Inf, int Cav, int Arc, double Damage) OptimizeMember(
        Member member, double rInf, double rCav, double rArc,
        double aInf, double aCav, double aArc)
    {
        if (member.MarchCount <= 0 || aInf <= 0 || aCav <= 0 || aArc <= 0)
            return (0, 0, 0, 0, 0);

        int bestK = 0, bestInf = 0, bestCav = 0, bestArc = 0;
        double bestDmg = 0;

        for (int k = 1; k <= member.MarchCount; k++)
        {
            var (inf, cav, arc, viable) = FitToRatio(
                member.Infantry / k, member.Cavalry / k, member.Archers / k,
                rInf, rCav, rArc);

            if (!viable) continue;

            var dmg = k * SingleMarchDamage(inf, cav, arc, aInf, aCav, aArc);
            if (dmg > bestDmg)
            {
                bestDmg = dmg;
                bestK = k;
                bestInf = inf;
                bestCav = cav;
                bestArc = arc;
            }
        }

        return (bestK, bestInf, bestCav, bestArc, bestDmg);
    }

    /// <summary>
    /// Optimize with an explicit max march count (for rally leads: marchCount + 1).
    /// </summary>
    public static (int BestK, int Inf, int Cav, int Arc, double Damage) OptimizeMemberK(
        Member member, double rInf, double rCav, double rArc,
        double aInf, double aCav, double aArc, int maxK)
    {
        if (maxK <= 0 || aInf <= 0 || aCav <= 0 || aArc <= 0)
            return (0, 0, 0, 0, 0);

        int bestK = 0, bestInf = 0, bestCav = 0, bestArc = 0;
        double bestDmg = 0;

        for (int k = 1; k <= maxK; k++)
        {
            var (inf, cav, arc, viable) = FitToRatio(
                member.Infantry / k, member.Cavalry / k, member.Archers / k,
                rInf, rCav, rArc);

            if (!viable) continue;

            var dmg = k * SingleMarchDamage(inf, cav, arc, aInf, aCav, aArc);
            if (dmg > bestDmg)
            {
                bestDmg = dmg;
                bestK = k;
                bestInf = inf;
                bestCav = cav;
                bestArc = arc;
            }
        }

        return (bestK, bestInf, bestCav, bestArc, bestDmg);
    }

    /// <summary>Damage coefficient for one unit of troops at this leader's optimal ratio.
    /// Total damage = sqrt(totalTroops) * K.</summary>
    public static double LeaderCoefficient(double aInf, double aCav, double aArc)
    {
        if (aInf <= 0 || aCav <= 0 || aArc <= 0) return 0;
        var (rInf, rCav, rArc) = TargetRatio(aInf, aCav, aArc);
        return Math.Sqrt(rInf) * InfCoeff * aInf
             + Math.Sqrt(rCav) * CavCoeff * aCav
             + Math.Sqrt(rArc) * ArcCoeff * aArc;
    }
}
