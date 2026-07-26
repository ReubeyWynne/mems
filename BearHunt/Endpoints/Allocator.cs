using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class AllocatorEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/admin/allocator", async (
            IDatastarService sse, AppDbContext db, HttpRequest request,
            IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection)) return;

            var cycle = await db.Cycles.FindAsync(1);
            if (cycle == null)
            {
                await sse.PatchElementsAsync(
                    """<div id="allocator-results"><div class="next-bear-card"><p>No cycle configured yet.</p></div></div>""");
                return;
            }

            var allPrefs = await db.Preferences.ToListAsync();
            var members = await db.Members.ToDictionaryAsync(m => m.Username);
            var sb = new System.Text.StringBuilder();
            sb.Append("""<div class="allocator-stack">""");

            sb.Append("""<div class="alloc-info"><strong>How it works</strong> &mdash; Damage scales with &radic;<span style="text-decoration:overline">troops</span>, so the first 100K troops deal far more per-troop than the next 100K. <em>Spreading</em> troops across many rallies beats dumping everything into one whale. The goal is to fill every rally you can &mdash; staggered rallies maximise participation, and total rally capacity should exceed total troop supply so troops cycle through waves.</div>""");

            sb.Append(BuildTrapSection("1", cycle.Trap1Time, allPrefs, members));
            sb.Append(BuildTrapSection("2", cycle.Trap2Time, allPrefs, members));

            sb.Append("""</div>""");
            await sse.PatchElementsAsync($"""<div id="allocator-results">{sb}</div>""");
        });
    }

    static string BuildTrapSection(string trap, TimeOnly trapTime,
        List<Preference> allPrefs, Dictionary<string, Member> members)
    {
        var prefs = allPrefs.Where(p => p.SelectedTrap == trap || p.SelectedTrap == "either").ToList();

        // Gather rally leads with stats — compute per-leader damage coefficients
        var leaderInfos = new List<LeaderInfo>();
        foreach (var lp in prefs.Where(p => p.IsRallyLead))
        {
            if (!members.TryGetValue(lp.Username, out var lm)) continue;
            var aInf = DamageCalc.AttackFactor(lm.InfantryAtkPct, lm.InfantryLethalityPct);
            var aCav = DamageCalc.AttackFactor(lm.CavalryAtkPct, lm.CavalryLethalityPct);
            var aArc = DamageCalc.AttackFactor(lm.ArcherAtkPct, lm.ArcherLethalityPct);
            if (aInf <= 0 || aCav <= 0 || aArc <= 0) continue;
            var k = DamageCalc.LeaderCoefficient(aInf, aCav, aArc);
            var (rInf, rCav, rArc) = DamageCalc.TargetRatio(aInf, aCav, aArc);
            leaderInfos.Add(new(lp.Username, k, rInf, rCav, rArc, lm.RallySize));
        }
        // Sort by damage coefficient K descending
        leaderInfos.Sort((a, b) => b.K.CompareTo(a.K));

        var sb = new System.Text.StringBuilder();
        sb.Append($"""<div class="trap-roster trap-{trap}"><div class="trap-header"><span class="trap-label">Trap {trap}</span><span class="trap-time">{trapTime:HH:mm}</span><span class="trap-count">{prefs.Count}</span></div>""");

        if (prefs.Count == 0)
        {
            sb.Append("""<p class="trap-empty">No signups yet.</p>""");
        }
        else if (leaderInfos.Count == 0)
        {
            sb.Append("""<div class="allocator-ratio">No rally leaders with stats</div>""");
            sb.Append(BuildSignupTable(prefs, members));
        }
        else
        {
            // ── Capacity diagnostic ──
            long totalCapacity = leaderInfos.Sum(l => (long)l.RallyCapacity);
            long totalSupply = prefs.Sum(p =>
                members.TryGetValue(p.Username, out var m) ? (long)(m.Infantry + m.Cavalry + m.Archers) : 0);
            double capRatio = totalSupply > 0 ? (double)totalCapacity / totalSupply : 0;
            string capClass = capRatio >= 1.0 ? "alloc-capacity-ok"
                : capRatio >= 0.8 ? "alloc-capacity-warn" : "alloc-capacity-tight";
            sb.Append($"""<div class="alloc-capacity {capClass}">Rally Capacity {Templates.FmtK((int)totalCapacity)} / Troop Supply {Templates.FmtK((int)totalSupply)} = {capRatio:0.00}</div>""");

            // ── Allocator table ──
            sb.Append("""<table class="trap-table alloc-table">""");
            sb.Append("""<colgroup><col style="width:90px"><col style="width:142px">""");
            for (int li = 0; li < leaderInfos.Count; li++)
                sb.Append("""<col style="width:78px">""");
            sb.Append("""<col style="width:68px"></colgroup>""");
            sb.Append("""<thead><tr><th>Player</th><th>I/C/A</th>""");
            foreach (var li in leaderInfos)
                sb.Append($"""<th class="alloc-leader-col">{Templates.E(li.Username)}<br><span class="alloc-k">K={li.K:0.0}</span><br><span class="alloc-cap">{Templates.FmtK(li.RallyCapacity)}</span></th>""");
            sb.Append("""<th class="alloc-col">Total Dmg</th></tr></thead><tbody>""");

            int signupCount = prefs.Count;

            foreach (var p in prefs.OrderBy(p => p.Username))
            {
                members.TryGetValue(p.Username, out var m);
                var username = Templates.E(p.Username);
                var rallyBadge = p.IsRallyLead ? """ <span class="rally-badge" title="Rally Lead">&#9733;</span>""" : "";

                // Troop display
                string troops;
                if (m is not null)
                {
                    var total = m.Infantry + m.Cavalry + m.Archers;
                    if (total == 0)
                        troops = "\u2014";
                    else
                    {
                        var i = m.Infantry * 100 / total;
                        var c = m.Cavalry * 100 / total;
                        var a = m.Archers * 100 / total;
                        troops = $"{Templates.FmtK(m.Infantry)}/{Templates.FmtK(m.Cavalry)}/{Templates.FmtK(m.Archers)} <span class=\"formation\">({i}/{c}/{a})</span>";
                    }
                }
                else
                {
                    troops = "\u2014";
                }

                sb.Append($"""<tr class="trap-row{(p.IsRallyLead ? " rally-lead" : "")}"><td>{username}{rallyBadge}</td><td class="troops-col">{troops}</td>""");

                // ── Per-leader allocations ──
                var allocs = new (int TotalTroops, double Damage, bool IsOwn)[leaderInfos.Count];
                double totalMemberDmg = 0;

                if (m is not null && m.Infantry + m.Cavalry + m.Archers > 0 && m.MarchCount > 0)
                {
                    int infAvail = m.Infantry;
                    int cavAvail = m.Cavalry;
                    int arcAvail = m.Archers;

                    // How many leaders can this member join?
                    int maxJoins = p.IsRallyLead ? m.MarchCount + 1 : m.MarchCount;

                    // Own rally gets priority (leader commits own troops first)
                    int ownIdx = p.IsRallyLead
                        ? leaderInfos.FindIndex(li => li.Username == p.Username)
                        : -1;

                    if (ownIdx >= 0)
                    {
                        var liOwn = leaderInfos[ownIdx];
                        var (ownInf, ownCav, ownArc, ownViable) = DamageCalc.FitToRatio(
                            infAvail, cavAvail, arcAvail, liOwn.RInf, liOwn.RCav, liOwn.RArc);
                        if (ownViable)
                        {
                            int ownTotal = ownInf + ownCav + ownArc;
                            double ownDmg = Math.Sqrt(ownTotal) * liOwn.K;
                            allocs[ownIdx] = (ownTotal, ownDmg, true);
                            totalMemberDmg += ownDmg;
                            infAvail -= ownInf;
                            cavAvail -= ownCav;
                            arcAvail -= ownArc;
                        }
                    }

                    // Remaining joins: top leaders by K (excluding own if already allocated)
                    int remainingJoins = maxJoins - (allocs[ownIdx >= 0 ? ownIdx : 0].Damage > 0 ? 1 : 0);
                    int joined = 0;
                    for (int li = 0; li < leaderInfos.Count && joined < remainingJoins; li++)
                    {
                        if (li == ownIdx && allocs[li].Damage > 0) continue; // already allocated own rally
                        int remTotal = infAvail + cavAvail + arcAvail;
                        if (remTotal <= 0) break;

                        var ldr = leaderInfos[li];

                        // Capacity cap: fair share of this leader's rally
                        int capShare = signupCount > 0 ? ldr.RallyCapacity / signupCount : int.MaxValue;

                        // Fit available troops to leader's ratio
                        var (aInf, aCav, aArc, viable) = DamageCalc.FitToRatio(
                            infAvail, cavAvail, arcAvail, ldr.RInf, ldr.RCav, ldr.RArc);
                        int used = aInf + aCav + aArc;
                        // Apply capacity cap: scale down if needed, but preserve viability
                        if (used > capShare && capShare > 0)
                        {
                            double scale = (double)capShare / used;
                            int sInf = (int)(aInf * scale);
                            int sCav = (int)(aCav * scale);
                            int sArc = (int)(aArc * scale);
                            int sTotal = sInf + sCav + sArc;
                            if (sTotal >= DamageCalc.MinTotal && sInf >= DamageCalc.MinPerType
                                && sCav >= DamageCalc.MinPerType && sArc >= DamageCalc.MinPerType)
                            {
                                aInf = sInf; aCav = sCav; aArc = sArc;
                                used = sTotal;
                            }
                            // else: uncapped (exceeds fair share but still viable)
                        }

                        double dmg = Math.Sqrt(used) * ldr.K;
                        allocs[li] = (used, dmg, false);
                        totalMemberDmg += dmg;
                        infAvail -= aInf;
                        cavAvail -= aCav;
                        arcAvail -= aArc;
                        joined++;
                    }
                }

                // ── Render per-leader cells ──
                for (int li = 0; li < leaderInfos.Count; li++)
                {
                    var alloc = allocs[li];
                    if (alloc.Damage > 0)
                    {
                        string marker = alloc.IsOwn ? " \u2605" : "";
                        sb.Append($"""<td class="alloc-leader-col">{Templates.FmtK(alloc.TotalTroops)}{marker}<br><span class="alloc-dmg">{alloc.Damage / 1_000_000:0.0}M</span></td>""");
                    }
                    else
                    {
                        sb.Append("""<td class="alloc-leader-col">—</td>""");
                    }
                }

                // Total damage column
                string totalDmgCol = totalMemberDmg > 0 ? $"{totalMemberDmg / 1_000_000:0.0}M" : "\u2014";
                sb.Append($"""<td class="alloc-col">{totalDmgCol}</td></tr>""");
            }

            sb.Append("""</tbody></table>""");
        }

        sb.Append("""</div>""");
        return sb.ToString();
    }

    static string BuildSignupTable(List<Preference> prefs, Dictionary<string, Member> members)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append("""<table class="trap-table"><thead><tr>""");
        sb.Append("""<th>Player</th><th>I/C/A</th><th>March</th><th>Hero</th><th>Wave</th>""");
        sb.Append("""</tr></thead><tbody>""");
        foreach (var p in prefs.OrderBy(p => p.Username))
        {
            members.TryGetValue(p.Username, out var m);
            var username = Templates.E(p.Username);
            var rallyBadge = p.IsRallyLead ? """ <span class="rally-badge" title="Rally Lead">&#9733;</span>""" : "";

            string troops, march, hero;
            if (m is not null)
            {
                var total = m.Infantry + m.Cavalry + m.Archers;
                if (total == 0)
                {
                    troops = "\u2014";
                }
                else
                {
                    var i = m.Infantry * 100 / total;
                    var c = m.Cavalry * 100 / total;
                    var a = m.Archers * 100 / total;
                    troops = $"{Templates.FmtK(m.Infantry)}/{Templates.FmtK(m.Cavalry)}/{Templates.FmtK(m.Archers)} <span class=\"formation\">({i}/{c}/{a})</span>";
                }
                march = m.RallySize > 0
                    ? Templates.FmtK(m.RallySize)
                    : m.SoloMarchSize > 0 ? $"{Templates.FmtK(m.SoloMarchSize)}s" : "\u2014";
                hero = !string.IsNullOrEmpty(m.RallyLeadHero)
                    ? $"{Templates.E(m.RallyLeadHero)} <span class=\"hero-lv\">Lv{m.WidgetLevel}</span>"
                    : "\u2014";
            }
            else
            {
                troops = "\u2014"; march = "\u2014"; hero = "\u2014";
            }
            sb.Append($"""<tr class="trap-row{(p.IsRallyLead ? " rally-lead" : "")}"><td>{username}{rallyBadge}</td><td class="troops-col">{troops}</td><td class="march-col">{march}</td><td class="hero-col">{hero}</td><td>{Templates.E(p.Wave ?? "")}</td></tr>""");
        }
        sb.Append("""</tbody></table>""");
        return sb.ToString();
    }
}
