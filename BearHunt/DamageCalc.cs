namespace BearHunt;

using BearHunt.Models;

/// <summary>
/// Bear-hunt damage math core (pure; no I/O).
/// Model pinned from the frakinator bear calculator:
/// per-joiner damage per rally = sum_t base_t * A_t(leader) * sqrt(n_t),
/// with base ratios inf 1/3, cav 1, archers 4.4/3 (the 4.4 = 4 * 1.1
/// archer-vs-infantry bonus; NO extra 1.1 until TG3+).
/// </summary>
public static class DamageCalc
{
    // base_att ratios at the current tier stage
    public const double InfCoeff = 1.0 / 3.0;
    public const double CavCoeff = 1.0;
    public const double ArcCoeff = 4.4 / 3.0; // flip to 4.84/3 when TG3+ archer bonus lands

    // Recommended minimum per troop type per march
    public const int MinPerType = 5000;

    /// <summary>Attack factor: A = (1 + atk%/100) x (1 + let%/100). 0 when either stat is missing.</summary>
    public static double AttackFactor(int? atkPct, int? letPct)
    {
        if (atkPct is null || letPct is null) return 0;
        return (1.0 + atkPct.Value / 100.0) * (1.0 + letPct.Value / 100.0);
    }

    /// <summary>
    /// Optimal troop ratio (fractions summing to 1) for a leader:
    /// f_i = alpha_i^2 / sum(alpha_j^2) with alpha = (A_inf/3, A_cav, 4.4*A_arc/3).
    /// </summary>
    public static (double Inf, double Cav, double Arc) TargetRatio(
        double aInf, double aCav, double aArc)
    {
        if (aInf <= 0 || aCav <= 0 || aArc <= 0)
            return (0.33, 0.33, 0.34); // fallback: equal split

        var alpha = InfCoeff * aInf;  // aInf / 3
        var beta = CavCoeff * aCav;   // aCav
        var gamma = ArcCoeff * aArc;  // 4.4 * aArc / 3

        var alpha2 = alpha * alpha;
        var beta2 = beta * beta;
        var gamma2 = gamma * gamma;
        var denom = alpha2 + beta2 + gamma2;

        return (alpha2 / denom, beta2 / denom, gamma2 / denom);
    }

    /// <summary>
    /// Leader quality K = sqrt((aInf/3)^2 + aCav^2 + (4.4*aArc/3)^2).
    /// Rank rally leads by this.
    /// </summary>
    public static double LeaderQuality(double aInf, double aCav, double aArc)
    {
        if (aInf <= 0 || aCav <= 0 || aArc <= 0) return 0;
        var x = InfCoeff * aInf;
        var y = CavCoeff * aCav;
        var z = ArcCoeff * aArc;
        return Math.Sqrt(x * x + y * y + z * z);
    }

    /// <summary>
    /// Per-joiner, per-rally damage in relative units (no C constant, no calibration):
    /// = sqrt(inf) * aInf/3 + sqrt(cav) * aCav + sqrt(arc) * 4.4*aArc/3.
    /// </summary>
    public static double MarchDamage(double aInf, double aCav, double aArc, int inf, int cav, int arc)
    {
        return Math.Sqrt(Math.Max(0, inf)) * InfCoeff * aInf
             + Math.Sqrt(Math.Max(0, cav)) * CavCoeff * aCav
             + Math.Sqrt(Math.Max(0, arc)) * ArcCoeff * aArc;
    }

    /// <summary>
    /// Recommended per-march composition for a player with q marches and a per-march cap,
    /// targeting the given leader ratio.
    /// </summary>
    public static (int Inf, int Cav, int Arc) RecommendMarch(
        int infPool, int cavPool, int arcPool, int q, int perMarchCap,
        double rInf, double rCav, double rArc)
    {
        q = Math.Max(1, q);
        var cap = perMarchCap <= 0 ? int.MaxValue : perMarchCap;

        // per-queue share (integer division); negative/zero pools send nothing
        var aI = Math.Max(0, infPool) / q;
        var aC = Math.Max(0, cavPool) / q;
        var aA = Math.Max(0, arcPool) / q;

        var targetArc = rArc * (aI + aC + aA);

        if (aA < targetArc)
        {
            // archer-scarce regime: all archers, 5k inf floor, cav fills
            var arcJ = Math.Min(aA, cap);
            var infJ = Math.Min(Math.Min(MinPerType, aI), Math.Max(0, cap - arcJ));
            var cavJ = Math.Min(aC, Math.Max(0, cap - arcJ - infJ));
            return (infJ, cavJ, arcJ);
        }

        // archer-abundant regime: fit the ratio, scaled to the scarcest queue share
        var scale = Math.Min(Math.Min(aI / rInf, aC / rCav), aA / rArc);
        double i = rInf * scale;
        double c = rCav * scale;
        double a = rArc * scale;

        var total = i + c + a;
        if (total > cap) // cap binds -> scale down, keep ratio
        {
            var k = cap / total;
            i *= k; c *= k; a *= k;
        }

        // floors: pull from cav filler, only when the player can afford the floor
        if (i < MinPerType && aI >= MinPerType)
        {
            var take = Math.Min(MinPerType - i, c);
            i += take; c -= take;
        }
        if (a < MinPerType && aA >= MinPerType)
        {
            var take = Math.Min(MinPerType - a, c);
            a += take; c -= take;
        }

        return ((int)i, (int)c, (int)a);
    }
}
