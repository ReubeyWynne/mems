using BearHunt.Models;
using Microsoft.AspNetCore.Http;

namespace BearHunt;

/// <summary>
/// Shared engine for the Academy "Bear Strategies" interactive timeline.
/// A pure, DB-free projection: given the controls (rally leads L, participants P,
/// queues Q, joiner slots S, event length, spread, travel) it builds the
/// parametric staggered-launch plan and a free-for-all reference over ONE shared
/// axis, computes the per-minute fire density and the readouts.
/// Rendering lives in <see cref="BearHunt.Components.Fragments.AcademyTimelineView"/>,
/// rendered by both the SSR page and the /api/academy/timeline Datastar endpoint
/// (via RazorRenderer) so the two can never drift apart.
///
/// Model: a bear rally fires exactly FireDelay minutes after launch, then
/// fights + travels home (~Travel minutes), so each lead relaunches every
/// Cycle = FireDelay + Travel minutes. Groups 1–2 carry the entire first wave
/// (that is the capacity check); the later groups launch empty and fill from
/// the round-1 returnees. Launching after last call (EventLength − FireDelay)
/// would fire past the bell. The free-for-all reference uses the same leads
/// and participants but plays them sloppily: a 0:00 rush, per-lead dropout,
/// and longer travel for far leads.
/// </summary>
public static class AcademyTimeline
{
    /// <summary>A bear rally fires exactly this many minutes after launch.</summary>
    public const double FireDelay = 5;

    // Fixed game rules — constants, not controls.
    public const int EventLength = 30;   // the event always runs 30 minutes
    public const int JoinerSlots = 14;   // a rally holds 1 lead + 14 joiners = 15
    public const int TravelSeconds = 30; // fight + travel home (~30s)

    /// <summary>Group 4's leads are the fast group: 20s fight+travel vs the 30s
    /// everyone else rides. That is exactly what lets group 4 squeeze in a 5th
    /// round (5th launch 24:20, fires 29:20) — at 30s it would land on last call.</summary>
    public const int Group4TravelSeconds = 20;

    // Control defaults and ranges (mirror the Academy form controls).
    public const int DefaultLeads = 15;
    public const int DefaultParticipants = 25;
    public const int DefaultQ = 4;
    public const int DefaultSpreadSeconds = 0;
    public const int MaxLeads = 100;
    public const int MaxParticipants = 300;
    public const int MaxQ = 6;
    public const int MaxSpreadSeconds = 24; // leads spread at most ~24s apart within a group

    /// <summary>One rally lead: display name + strength K (0 when unknown / generic).</summary>
    public sealed record LeadRef(string Name, double K);

    /// <summary>Parsed timeline controls (query params / Datastar signals).</summary>
    public sealed record Inputs(
        int Leads = DefaultLeads,
        int Participants = DefaultParticipants,
        int Q = DefaultQ,
        int SpreadSeconds = DefaultSpreadSeconds,
        /// <summary>A 5th launch group is optional — it can never fire all five
        /// rounds (a 5th needs every lead's travel under 15s), so only alliances
        /// with an excess of strong leads should field it.</summary>
        bool UseGroup5 = true,
        TimeOnly? TrapAnchor = null,
        IReadOnlyList<LeadRef> LeadNames = null!,
        /// <summary>Optional per-lead fight+travel seconds; null = the global TravelSeconds for every lead.</summary>
        IReadOnlyList<int>? TravelSecondsPerLead = null,
        /// <summary>Optional per-participant Q (real MarchCounts); null = the global Q for every participant.</summary>
        IReadOnlyList<int>? ParticipantQs = null);

    public enum SegKind { March, Reload, Launch, Fight, Join }

    /// <param name="FillAt">Round-1 march of groups 3+: the minute the empty rally
    /// fills (returnees from groups 1–2); null = filled at launch.</param>
    public sealed record Seg(double From, double To, SegKind Kind, bool Reload, double? FillAt = null);

    /// <summary>One staggered launch group lane.</summary>
    public sealed record Lane(
        int Index, string Name,
        IReadOnlyList<Seg> Segs, IReadOnlyList<double> Fires,
        IReadOnlyList<LeadRef> Leads, int Rounds);

    /// <summary>The free-for-all reference (one shared clock with the lanes).</summary>
    public sealed record FfaInfo(IReadOnlyList<Seg> Segs, IReadOnlyList<double> Parked, IReadOnlyList<double> Fires);

    /// <summary>One minute of the event: fire counts for both plans.</summary>
    public sealed record DensityCell(int Minute, int FfaFires, int StagFires);

    /// <summary>Computed readouts over the projected fire timeline.</summary>
    public sealed record Readouts(
        double FiresPerMinuteMean,
        int MaxFiresPerMinute,
        double LongestSilence,
        double FfaLongestSilence,
        int RalliesFiredStag,
        int RalliesFiredFfa,
        double CoveragePct,
        int Capacity,
        int Demand,
        string Verdict,
        bool Overflow,
        int OverflowMarches,
        double MinutesParkedPerParticipant,
        int Rounds,
        int RalliesJoined,
        double RalliesJoinedPerParticipant,
        double FirstFire);

    /// <summary>The full plan: everything the timeline view needs.</summary>
    public sealed record Plan(
        int GroupCount,
        double LastCall,
        int Leads,
        int Participants,
        int Q,
        IReadOnlyList<Lane> Lanes,
        FfaInfo Ffa,
        IReadOnlyList<DensityCell> Density,
        int MaxDensity,
        Readouts Readouts,
        string? EmptyState,
        TimeOnly? TrapAnchor);

    // ─── Parse ────────────────────────────────────────────────────────────

    public static Inputs Parse(IQueryCollection q, Cycle? cycle,
        IReadOnlyList<Member> members, IReadOnlyList<Preference> prefs)
    {
        bool prefill = (q["source"].FirstOrDefault() ?? "custom") == "prefill";

        int leads = GetInt(q, "leads", DefaultLeads);
        int participants = GetInt(q, "participants", DefaultParticipants);
        var leadNames = new List<LeadRef>();
        List<int>? participantQs = null;
        TimeOnly? trapAnchor = null;

        if (prefill)
        {
            // Leads: rally leads with complete stats, strongest first.
            var byUser = members.GroupBy(m => m.Username).ToDictionary(g => g.Key, g => g.First());
            foreach (var p in prefs.Where(p => p.IsRallyLead)
                         .OrderBy(p => p.Username, StringComparer.Ordinal))
            {
                if (!byUser.TryGetValue(p.Username, out var m) || !CompleteStats(m)) continue;
                var aInf = DamageCalc.AttackFactor(m.InfantryAtkPct, m.InfantryLethalityPct);
                var aCav = DamageCalc.AttackFactor(m.CavalryAtkPct, m.CavalryLethalityPct);
                var aArc = DamageCalc.AttackFactor(m.ArcherAtkPct, m.ArcherLethalityPct);
                leadNames.Add(new LeadRef(p.Username, DamageCalc.LeaderQuality(aInf, aCav, aArc)));
            }
            leadNames.Sort((a, b) => b.K.CompareTo(a.K)); // strongest first
            if (leadNames.Count > MaxLeads) leadNames = leadNames.Take(MaxLeads).ToList();
            leads = leadNames.Count;
            participants = prefs.Count(p => !string.IsNullOrEmpty(p.SelectedTrap));
            trapAnchor = NextTrapTime(cycle);

            // Q per participant: the real MarchCount where known; a signup with
            // no member record gets 0 (no data → no marches to send).
            participantQs = new List<int>();
            foreach (var p in prefs.Where(p => !string.IsNullOrEmpty(p.SelectedTrap)))
            {
                int mc = byUser.TryGetValue(p.Username, out var m) ? m.MarchCount : 0;
                participantQs.Add(Math.Clamp(mc, 0, MaxQ));
            }
        }

        // Q: explicit 0 means the empty state ("no marches to send"), not an error.
        int q0 = GetInt(q, "q", DefaultQ);
        if (q0 < 0) q0 = 0;
        else if (q0 > MaxQ) q0 = MaxQ;

        // Group 5 toggle: absent (or truthy) means the usual 5 groups; a 5th
        // group is a stretch (it can never fire all five rounds), so alliances
        // without an excess of strong leads leave it off.
        bool useGroup5 = q["g5"].FirstOrDefault() is not ("false" or "0" or "off");

        return new Inputs(
            Leads: Math.Clamp(leads, 0, MaxLeads),
            Participants: Math.Clamp(participants, 1, MaxParticipants),
            Q: q0,
            SpreadSeconds: Math.Clamp(GetInt(q, "spread", DefaultSpreadSeconds), 0, MaxSpreadSeconds),
            UseGroup5: useGroup5,
            TrapAnchor: trapAnchor,
            LeadNames: prefill ? leadNames : new List<LeadRef>(),
            TravelSecondsPerLead: null,          // model parameter — no real per-lead travel data yet
            ParticipantQs: participantQs);
    }

    // ─── Compute ──────────────────────────────────────────────────────────

    public static Plan Compute(Inputs i)
    {
        double travel = TravelSeconds / 60.0;
        double cycle = FireDelay + travel;
        double lastCall = EventLength - FireDelay;

        int demand = i.ParticipantQs is { Count: > 0 } qs ? qs.Sum() : i.Participants * i.Q;

        string? empty = i.Leads <= 0
            ? "No rally leads — nothing can fire. Add leads on the schedule."
            : i.Participants <= 0
                ? "No participants — nothing to schedule."
                : demand <= 0
                    ? "Q is 0 — no marches to send."
                    : null;

        var lanes = new List<Lane>();
        var ffa = new FfaInfo(Array.Empty<Seg>(), Array.Empty<double>(), Array.Empty<double>());
        var cells = new List<DensityCell>();
        int maxDensity = 0;
        var allFires = new List<double>();

        if (empty is null)
        {
            int gCount = Math.Min(i.Leads, i.UseGroup5 ? 5 : 4); // ≥1 lead per group
            var leadRefs = i.LeadNames.Count > 0
                ? i.LeadNames.OrderByDescending(l => l.K).ToList()
                : Enumerable.Range(1, i.Leads).Select(k => new LeadRef($"Lead {k}", 0)).ToList();

            // Round-robin: lead k → group k % G. Prefill lists arrive strongest-first,
            // so the strongest leads land in the earliest groups.
            var groups = Enumerable.Range(0, gCount).Select(_ => new List<LeadRef>()).ToList();
            for (int k = 0; k < leadRefs.Count; k++) groups[k % gCount].Add(leadRefs[k]);

            // Per-lead travel is a model parameter: an explicit list wins; a null
            // list uses the game rule — group 4's leads ride the fast 20s clock
            // (that's how they fit a 5th round), everyone else the global 30s.
            // TravelOf takes the GLOBAL lead index (round-robin: group g holds
            // global leads g, g+gCount, g+2·gCount, …).
            var travelList = i.TravelSecondsPerLead;
            double TravelOf(int gi) =>
                travelList is { Count: > 0 } && gi < travelList.Count ? travelList[gi] / 60.0
                : gi % gCount == 3 ? Group4TravelSeconds / 60.0
                : travel;
            double CycleOf(int gi) => FireDelay + TravelOf(gi);

            for (int g = 0; g < gCount; g++)
            {
                var gl = groups[g];
                int n = gl.Count;
                var gIdx = Enumerable.Range(0, n).Select(k => g + k * gCount).ToArray();
                double minTravel = gIdx.Min(TravelOf);
                double maxTravel = gIdx.Max(TravelOf);
                // First returnees from group 1's round-1 fire: the minute the
                // later groups' empty rallies actually fill. Groups 1–2 always
                // ride the global travel, so the fill time never depends on the
                // hollow group's own (possibly fast) clock.
                double fillTime = FireDelay + travel;

                var segs = new List<Seg>();
                var fires = new List<double>();
                int rounds = 0;
                bool reload = false;
                for (int r = 0; ; r++)
                {
                    double launchMin = gIdx.Min(gi => g + r * CycleOf(gi));
                    if (launchMin >= lastCall) break; // last call
                    double launchMax = gIdx.Max(gi => g + r * CycleOf(gi));
                    double segTo = launchMax + FireDelay;
                    // Groups 3+ launch HOLLOW in round 1: the whole first wave
                    // lives in groups 1–2, so these rallies sit empty until the
                    // returnees arrive (~5:30) and only then become real fires.
                    bool emptyAtLaunch = r == 0 && g >= 2;
                    segs.Add(new Seg(launchMin, segTo, SegKind.March, reload, emptyAtLaunch ? fillTime : null));
                    segs.Add(new Seg(segTo, segTo + maxTravel, SegKind.Fight, false));
                    for (int k = 0; k < n; k++)
                    {
                        // Per-lead sub-minute offset within the group minute:
                        // spread seconds × position (0s at spread 0 → ~24s at max).
                        double launch = g + r * CycleOf(gIdx[k]);
                        double offset = n > 1 ? i.SpreadSeconds / 60.0 * (double)k / (n - 1) : 0;
                        if (launch + offset < lastCall) fires.Add(launch + FireDelay + offset);
                    }
                    reload = true;
                    rounds++;
                }
                fires.Sort();
                lanes.Add(new Lane(g, $"Group {g + 1}", segs, fires, gl, rounds));
                allFires.AddRange(fires);
            }
            allFires.Sort(); // global fire timeline — readouts need real consecutive gaps

            ffa = BuildFfa(i, travel, travelList, lastCall);

            // Density: one cell per minute m in [0, EventLength).
            int minutes = EventLength;
            for (int m = 0; m < minutes; m++)
            {
                int stag = allFires.Count(f => (int)Math.Floor(f) == m);
                int ffaCnt = ffa.Fires.Count(f => (int)Math.Floor(f) == m);
                cells.Add(new DensityCell(m, ffaCnt, stag));
                maxDensity = Math.Max(maxDensity, Math.Max(ffaCnt, stag));
            }
        }
        else
        {
            int minutes = EventLength;
            for (int m = 0; m < minutes; m++) cells.Add(new DensityCell(m, 0, 0));
        }

        return new Plan(
            GroupCount: Math.Min(i.Leads, i.UseGroup5 ? 5 : 4),
            LastCall: lastCall,
            Leads: i.Leads,
            Participants: i.Participants,
            Q: i.Q,
            Lanes: lanes,
            Ffa: ffa,
            Density: cells,
            MaxDensity: maxDensity,
            Readouts: ComputeReadouts(i, cycle, lanes, ffa, cells, allFires),
            EmptyState: empty,
            TrapAnchor: i.TrapAnchor);
    }

    /// <summary>
    /// Free-for-all reference: the SAME leads and participants as the staggered
    /// plan, played sloppily. Everyone rushes to launch at 0:00 (one giant fire
    /// at 5:00), then each lead independently decides whether to rally again and
    /// rides its own travel clock — far leads fire later and get fewer rounds.
    /// Seeded from the lead count alone, so identical inputs always reproduce
    /// the same baseline and the reference never moves while the user plays
    /// with the staggered controls.
    /// </summary>
    static FfaInfo BuildFfa(Inputs i, double travel, IReadOnlyList<int>? travelList, double lastCall)
    {
        var segs = new List<Seg>();
        var parked = new List<double>();
        var fires = new List<double>();
        if (i.Leads == 0) return new FfaInfo(segs, parked, fires);

        var rng = new Random(i.Leads * 1009 + 17);
        var perLeadTravel = new double[i.Leads];
        var relaunchProb = new double[i.Leads];
        for (int k = 0; k < i.Leads; k++)
        {
            // Far leads straggle: 30–90s of fight+travel instead of the clean 30s.
            perLeadTravel[k] = travelList is { Count: > 0 } && k < travelList.Count
                ? travelList[k] / 60.0
                : travel * (1 + 2 * rng.NextDouble());
            // Some leads simply stop rallying after the rush.
            relaunchProb[k] = 0.55 + 0.35 * rng.NextDouble();
        }
        double avgTravel = perLeadTravel.Average();

        // Round-r fire per lead: 5 + (r−1) × (5 + travel).
        var roundFires = new List<List<double>> { new() };
        roundFires[0].AddRange(Enumerable.Repeat(FireDelay, i.Leads));
        for (int k = 0; k < i.Leads; k++)
        {
            double fire = FireDelay;
            for (int r = 2; ; r++)
            {
                if (rng.NextDouble() > relaunchProb[k]) break;   // dropout — never rallies again
                double launch = fire + perLeadTravel[k];         // troops home → relaunch
                if (launch >= lastCall) break;                   // past last call
                fire = launch + FireDelay;
                while (roundFires.Count < r) roundFires.Add(new());
                roundFires[r - 1].Add(fire);
            }
        }

        // Segments: the 0:00 scramble, then per-round silence → ragged burst.
        segs.Add(new Seg(0, 1, SegKind.Launch, false));
        segs.Add(new Seg(1, FireDelay, SegKind.Reload, true));
        segs.Add(new Seg(FireDelay, FireDelay + avgTravel, SegKind.Fight, false));
        double prevEnd = FireDelay + avgTravel;
        for (int r = 1; r < roundFires.Count; r++)
        {
            var round = roundFires[r];
            if (round.Count == 0) continue;
            double minF = round.Min(), maxF = round.Max();
            segs.Add(new Seg(prevEnd, minF, SegKind.Reload, true));
            segs.Add(new Seg(minF, maxF + avgTravel, SegKind.Fight, false));
            if (maxF + 2 < EventLength) parked.Add(maxF + 2);
            prevEnd = maxF + avgTravel;
        }
        fires.AddRange(roundFires.SelectMany(f => f).OrderBy(f => f));

        return new FfaInfo(segs, parked, fires);
    }

    static Readouts ComputeReadouts(Inputs i, double cycle,
        IReadOnlyList<Lane> lanes, FfaInfo ffa, IReadOnlyList<DensityCell> cells, List<double> allFires)
    {
        // First-wave capacity: only groups 1–2 carry the initial P × Q marches;
        // groups 3+ stay hollow until the returnees fill them a cycle later.
        int firstWaveLeads = lanes.Count > 0
            ? lanes[0].Leads.Count + (lanes.Count > 1 ? lanes[1].Leads.Count : 0)
            : 0;
        int capacity = firstWaveLeads * JoinerSlots;
        int demand = i.ParticipantQs is { Count: > 0 } qs ? qs.Sum() : i.Participants * i.Q;
        int rounds = lanes.Count > 0 ? lanes.Max(l => l.Rounds) : 0;
        return FromFireTimes(allFires, ffa.Fires, capacity, demand, i.Participants, cycle, rounds);
    }

    /// <summary>
    /// Shared readout computation over raw fire timelines — the Academy timeline
    /// and the admin planner both go through this so their numbers can't drift.
    /// Staggered fires may arrive in any order (sorted here); FFA fires are the
    /// all-at-once baseline instants. Capacity/demand are joiner slots vs
    /// marches-to-send; overflow marches miss round 1 and launch a cycle late,
    /// so parked minutes scale with one cycle, not the whole event. Rounds = the
    /// number of launch rounds, used to project total rally joins: every round
    /// the full demand joins, except the round-1 overflow (joins one round late).
    /// </summary>
    public static Readouts FromFireTimes(
        IReadOnlyList<double> staggeredFires, IReadOnlyList<double> ffaFires,
        int capacity, int demand, int participants, double cycle, int rounds)
    {
        double window = EventLength - FireDelay;
        var stag = staggeredFires.OrderBy(f => f).ToList();
        var ffa = ffaFires.OrderBy(f => f).ToList();

        // Longest silence: max gap between consecutive fire times, first fire → last fire.
        double longestSilence = 0;
        for (int k = 1; k < stag.Count; k++)
            longestSilence = Math.Max(longestSilence, stag[k] - stag[k - 1]);
        double ffaSilence = 0;
        for (int k = 1; k < ffa.Count; k++)
            ffaSilence = Math.Max(ffaSilence, ffa[k] - ffa[k - 1]);

        int covered = 0, maxPerMinute = 0;
        for (int m = 0; m < EventLength; m++)
        {
            int c = stag.Count(f => (int)Math.Floor(f) == m);
            if (m >= FireDelay && m < EventLength && c > 0) covered++;
            maxPerMinute = Math.Max(maxPerMinute, c);
        }

        bool overflow = demand > capacity;
        int overflowMarches = overflow ? demand - capacity : 0;
        double parked = overflow && participants > 0
            ? (double)overflowMarches / participants * cycle
            : 0;

        // Total rally joins: every round all demand marches join a rally, except
        // the round-1 overflow which joins one round late.
        int ralliesJoined = Math.Max(0, demand * rounds - overflowMarches);
        double joinsPerParticipant = participants > 0 ? (double)ralliesJoined / participants : 0;

        return new Readouts(
            FiresPerMinuteMean: window > 0 ? stag.Count / window : 0,
            MaxFiresPerMinute: maxPerMinute,
            LongestSilence: longestSilence,
            FfaLongestSilence: ffaSilence,
            RalliesFiredStag: stag.Count,
            RalliesFiredFfa: ffa.Count,
            CoveragePct: window > 0 ? Math.Min(1, covered / window) : 0,
            Capacity: capacity,
            Demand: demand,
            Verdict: overflow ? "overflow" : "fits",
            Overflow: overflow,
            OverflowMarches: overflowMarches,
            MinutesParkedPerParticipant: parked,
            Rounds: rounds,
            RalliesJoined: ralliesJoined,
            RalliesJoinedPerParticipant: joinsPerParticipant,
            FirstFire: FireDelay);
    }

    // ─── Schedule helpers ─────────────────────────────────────────────────

    static TimeOnly? NextTrapTime(Cycle? cycle)
    {
        if (cycle is null) return null;
        var now = DateTime.UtcNow;
        var nextDate = cycle.StartDate;
        while (nextDate.Date < now.Date
            || (nextDate.Date == now.Date && nextDate.Date.Add(cycle.Trap2Time.ToTimeSpan()) <= now))
            nextDate = nextDate.AddDays(2);
        var trap1 = nextDate.Date.Add(cycle.Trap1Time.ToTimeSpan());
        return trap1 > now ? cycle.Trap1Time : cycle.Trap2Time;
    }

    static bool CompleteStats(Member m) =>
        m.InfantryAtkPct.HasValue && m.InfantryLethalityPct.HasValue
        && m.CavalryAtkPct.HasValue && m.CavalryLethalityPct.HasValue
        && m.ArcherAtkPct.HasValue && m.ArcherLethalityPct.HasValue;

    static int GetInt(IQueryCollection q, string key, int def) =>
        int.TryParse(q[key].FirstOrDefault(), out var n) ? n : def;
}
