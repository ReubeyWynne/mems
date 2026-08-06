namespace BearHunt;

using BearHunt.Models;

/// <summary>One rally slot: a lead's rally in its wave (launch group).</summary>
public sealed record RallySlot(string Trap, int Wave, string Lead, double K,
    int TroopCap, int PlayerCap, double RInf, double RCav, double RArc,
    int LeadSend, int FilledPlayers, long FilledTroops, bool CapAssumed);

/// <summary>One participant's march sent to one slot.</summary>
public sealed record MemberAssignment(string Username, string Trap, int Wave, string Lead,
    int Inf, int Cav, int Arc, double Damage);

/// <summary>A participant's full plan across the staggered waves.</summary>
public sealed record ParticipantPlan(string Username, bool IsLead, int Pool, int Q,
    double EstDamage, int Bracket, int WavesMissed, List<MemberAssignment> Assignments);

/// <summary>
/// Per-wave demand/capacity summary. A wave is a launch group: it launches at
/// LaunchOffset and fires at LaunchOffset + 5:00 (rally duration is fixed).
/// </summary>
public sealed record WaveSummary(string Trap, int Wave, TimeSpan LaunchOffset,
    TimeSpan FireOffset, int Demand, int Capacity, int FilledSlots, long FilledTroops);

/// <summary>Full plan for one trap (one staggered round).</summary>
public sealed record TrapPlan(string Trap, TimeOnly TrapTime,
    List<RallySlot> Slots, List<ParticipantPlan> Participants, List<WaveSummary> Waves,
    long TotalCapacity, long TotalDemand);

/// <summary>
/// Deterministic wave-plan engine. No DB access; the caller passes all data.
///
/// Model: a bear rally has a FIXED 5-minute duration — fire time = launch + 5:00.
/// "Waves" are staggered launch groups (the staggered-waves strategy):
/// group w launches w minutes after the trap starts (0:00, 1:00, 2:00, 3:00) and
/// fires at 5:00, 6:00, 7:00, 8:00. Leads are split across the 4 groups (round-robin
/// by K, strongest first) so every wave has strong rallies; the round repeats after
/// the first round lands.
///
/// Equity proxy: participants are assigned weakest-first (pool ascending), so the
/// highest-K rallies go to the players lowest on the damage curve.
/// </summary>
public static class WavePlanner
{
    public const int WaveCount = 4; // the 4 staggered launch groups

    // Real reward thresholds (relative units before calibration).
    public static readonly double[] Brackets = { 47_000_000, 90_000_000, 175_000_000 };

    sealed record LeadInfo(string Username, int Group, double K,
        double RInf, double RCav, double RArc,
        double AInf, double ACav, double AArc,
        int TroopCap, int PlayerCap, int FairShare, int LeadSend, bool CapAssumed);

    sealed record ParticipantInfo(string Username, bool IsLead, int Inf, int Cav, int Arc, int Q)
    {
        public int Pool => Inf + Cav + Arc;
    }

    public static TrapPlan BuildPlan(string trap, TimeOnly trapTime,
        Dictionary<string, Member> members, List<Preference> prefs, double calibration)
    {
        // 1. signups: this trap (or "either"), ordered by username
        var signups = prefs
            .Where(p => p.SelectedTrap == trap || p.SelectedTrap == "either")
            .OrderBy(p => p.Username, StringComparer.Ordinal)
            .ToList();

        // 2. leads: rally leads with complete stats, ranked by K = LeaderQuality desc
        var leads = new List<LeadInfo>();
        foreach (var p in signups.Where(p => p.IsRallyLead))
        {
            if (!members.TryGetValue(p.Username, out var m)) continue;
            var aInf = DamageCalc.AttackFactor(m.InfantryAtkPct, m.InfantryLethalityPct);
            var aCav = DamageCalc.AttackFactor(m.CavalryAtkPct, m.CavalryLethalityPct);
            var aArc = DamageCalc.AttackFactor(m.ArcherAtkPct, m.ArcherLethalityPct);
            if (aInf <= 0 || aCav <= 0 || aArc <= 0) continue;

            // 3. caps with defaults; flag assumed caps
            bool capAssumed = m.RallySize <= 0 || m.RallyJoinerCap <= 0;
            int troopCap = m.RallySize > 0 ? m.RallySize : 500_000;
            int playerCap = m.RallyJoinerCap > 0 ? m.RallyJoinerCap : 15;
            int fairShare = troopCap / playerCap;

            int leadPool = m.Infantry + m.Cavalry + m.Archers;
            int leadSend = Math.Max(15_000, Math.Min(leadPool, fairShare));

            var k = DamageCalc.LeaderQuality(aInf, aCav, aArc);
            var (rInf, rCav, rArc) = DamageCalc.TargetRatio(aInf, aCav, aArc);
            leads.Add(new LeadInfo(p.Username, 0, k, rInf, rCav, rArc, aInf, aCav, aArc,
                troopCap, playerCap, fairShare, leadSend, capAssumed));
        }
        leads.Sort((a, b) => b.K.CompareTo(a.K));

        // 4. split leads into 4 launch groups, round-robin by K: each lead leads the
        //    rally of its own wave (the strat's "strongest, most consistent leads",
        //    with weaker leads still covered rather than left out).
        for (int i = 0; i < leads.Count; i++)
            leads[i] = leads[i] with { Group = i % WaveCount };

        // 6. participants: all signups, weakest-first (pool ascending)
        var participants = signups
            .Select(p =>
            {
                members.TryGetValue(p.Username, out var m);
                int inf = m?.Infantry ?? 0;
                int cav = m?.Cavalry ?? 0;
                int arc = m?.Archers ?? 0;
                int q = m is null || m.MarchCount <= 0 ? 1 : m.MarchCount;
                return new ParticipantInfo(p.Username, p.IsRallyLead, inf, cav, arc, q);
            })
            .OrderBy(p => p.Pool)
            .ToList();

        // mutable per-slot fill state, keyed by (lead, wave) — a lead only fills its own wave
        var fills = new Dictionary<(string Lead, int Wave), (int Players, long Troops)>();
        foreach (var l in leads)
            fills[(l.Username, l.Group)] = (0, 0);

        var assignments = participants.ToDictionary(p => p.Username, _ => new List<MemberAssignment>());
        var missed = participants.ToDictionary(p => p.Username, _ => 0);

        // 7. per-wave assignment
        var waves = new List<WaveSummary>();
        for (int w = 0; w < WaveCount; w++)
        {
            var waveLeads = leads.Where(l => l.Group == w).ToList();
            var launchOffset = TimeSpan.FromMinutes(w);          // group w launches w min in
            var fireOffset = TimeSpan.FromMinutes(w + 5);        // rally duration is fixed 5:00
            int demand = participants.Sum(p => p.Q);
            int capacity = waveLeads.Sum(l => l.PlayerCap);

            foreach (var p in participants)
            {
                int sent = 0;
                int remInf = p.Inf, remCav = p.Cav, remArc = p.Arc;
                var own = waveLeads.FirstOrDefault(l => l.Username == p.Username);

                // 5. own rally first (only in the lead's own wave): consumes 1 slot and
                //    leadSend troops (of that slot)
                if (own is not null && sent < p.Q && fills[(own.Username, w)].Players < own.PlayerCap)
                {
                    var (inf, cav, arc) = DamageCalc.RecommendMarch(p.Inf, p.Cav, p.Arc, p.Q, own.LeadSend,
                        own.RInf, own.RCav, own.RArc);
                    var dmg = DamageCalc.MarchDamage(own.AInf, own.ACav, own.AArc, inf, cav, arc);
                    assignments[p.Username].Add(new MemberAssignment(p.Username, trap, w, own.Username, inf, cav, arc, dmg));
                    var f = fills[(own.Username, w)];
                    fills[(own.Username, w)] = (f.Players + 1, f.Troops + inf + cav + arc);
                    remInf -= inf; remCav -= cav; remArc -= arc;
                    sent++;
                }

                // remaining marches join this wave's other slots: most free player slots,
                // tie-break K desc
                var candidates = waveLeads
                    .Where(l => l.Username != p.Username)
                    .OrderByDescending(l => l.PlayerCap - fills[(l.Username, w)].Players)
                    .ThenByDescending(l => l.K)
                    .ToList();

                foreach (var l in candidates)
                {
                    if (sent >= p.Q) break;
                    if (fills[(l.Username, w)].Players >= l.PlayerCap) continue;

                    var (inf, cav, arc) = DamageCalc.RecommendMarch(remInf, remCav, remArc, p.Q, l.FairShare,
                        l.RInf, l.RCav, l.RArc);
                    var dmg = DamageCalc.MarchDamage(l.AInf, l.ACav, l.AArc, inf, cav, arc);
                    assignments[p.Username].Add(new MemberAssignment(p.Username, trap, w, l.Username, inf, cav, arc, dmg));
                    var f = fills[(l.Username, w)];
                    fills[(l.Username, w)] = (f.Players + 1, f.Troops + inf + cav + arc);
                    remInf -= inf; remCav -= cav; remArc -= arc;
                    sent++;
                }

                // no free slot in this wave -> missed, not shuffled
                if (sent == 0) missed[p.Username]++;
            }

            int filledSlots = waveLeads.Count(l => fills[(l.Username, w)].Players > 0);
            long filledTroops = waveLeads.Sum(l => fills[(l.Username, w)].Troops);
            waves.Add(new WaveSummary(trap, w, launchOffset, fireOffset, demand, capacity, filledSlots, filledTroops));
        }

        // 8. participant plans: est. damage (calibrated) + bracket band
        var participantsOut = participants.Select(p =>
        {
            var asg = assignments[p.Username];
            double est = calibration * asg.Sum(a => a.Damage);
            int bracket = Brackets.Count(b => est > b); // 0 = below 47M ... 3 = >= 175M
            return new ParticipantPlan(p.Username, p.IsLead, p.Pool, p.Q, est, bracket,
                missed[p.Username], asg);
        }).ToList();

        // 9. slot records + trap totals (one slot per lead, in the lead's own wave)
        var slotsOut = leads.Select(l =>
        {
            var f = fills[(l.Username, l.Group)];
            return new RallySlot(trap, l.Group, l.Username, l.K, l.TroopCap, l.PlayerCap,
                l.RInf, l.RCav, l.RArc, l.LeadSend, f.Players, f.Troops, l.CapAssumed);
        }).ToList();

        long totalCapacity = slotsOut.Sum(s => (long)s.TroopCap);
        long totalDemand = (long)participants.Sum(p => p.Q) * WaveCount;
        return new TrapPlan(trap, trapTime, slotsOut, participantsOut, waves, totalCapacity, totalDemand);
    }
}
