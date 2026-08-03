using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class WavePlannerEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/admin/planner", async (
            IDatastarService sse, AppDbContext db, HttpRequest request,
            IDataProtectionProvider protection, IConfiguration config) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection)) return;

            var cycle = await db.Cycles.FindAsync(1);
            if (cycle == null)
            {
                await sse.PatchElementsAsync("""<div id="planner-results">No cycle configured yet.</div>""");
                return;
            }

            var prefs = await db.Preferences.ToListAsync();
            var members = await db.Members.ToDictionaryAsync(m => m.Username);
            double calibration = double.TryParse(config["Bear:Calibration"], out var d) ? d : 1.0;

            var sb = new System.Text.StringBuilder();
            sb.Append("""<div class="planner-stack">""");
            sb.Append(BuildTrapSection("1", cycle.Trap1Time, members, prefs, calibration));
            sb.Append(BuildTrapSection("2", cycle.Trap2Time, members, prefs, calibration));
            sb.Append("""</div>""");

            await sse.PatchElementsAsync($"""<div id="planner-results">{sb}</div>""");
        });
    }

    static string BuildTrapSection(string trap, TimeOnly trapTime,
        Dictionary<string, Member> members, List<Preference> prefs, double calibration)
    {
        var plan = WavePlanner.BuildPlan(trap, trapTime, members, prefs, calibration);
        var sb = new System.Text.StringBuilder();
        sb.Append($"""<div class="plan-trap trap-roster trap-{trap}"><div class="trap-header"><span class="trap-label">Trap {trap}</span><span class="trap-time">{trapTime:HH:mm}</span><span class="trap-count">{plan.Participants.Count}</span></div>""");

        if (plan.Participants.Count == 0)
        {
            sb.Append("""<p class="trap-empty">No signups yet.</p>""");
            sb.Append("""</div>""");
            return sb.ToString();
        }

        if (plan.Slots.Count == 0)
        {
            sb.Append("""<div class="plan-note">No rally leads with stats — add one on their profile (all six atk/let fields), then toggle &#9733; on the schedule.</div>""");
        }
        else
        {
            // ── Lead chips: name, K, optimal fractions, caps, launch wave, cap-assumed flag ──
            sb.Append("""<div class="plan-leads">""");
            foreach (var slot in plan.Slots)
            {
                var launch = trapTime.AddMinutes(slot.Wave);
                var flag = slot.CapAssumed ? """<span class="flag-warn">cap assumed</span>""" : "";
                sb.Append($"""<div class="plan-lead-chip"><span class="plan-lead-name">&#9733; {Templates.E(slot.Lead)}</span><span class="plan-k">K={slot.K:0.0}</span><span class="plan-ratio">{slot.RInf * 100:0.0}/{slot.RCav * 100:0.0}/{slot.RArc * 100:0.0}</span><span class="plan-caps">{Templates.FmtK(slot.TroopCap)} &middot; {slot.PlayerCap} slots</span><span class="plan-launch">wave {slot.Wave} &middot; launch {launch:HH:mm:ss}</span>{flag}</div>""");
            }
            sb.Append("""</div>""");

            // ── Wave grid: slots + per-wave summary ──
            sb.Append("""<div class="plan-waves">""");
            foreach (var summary in plan.Waves)
            {
                var launch = trapTime.Add(summary.LaunchOffset);
                var fire = trapTime.Add(summary.FireOffset);
                var joinFrom = fire.Add(-TimeSpan.FromMinutes(1));
                sb.Append($"""<div class="plan-wave"><div class="plan-wave-head">Wave {summary.Wave} <span class="plan-launch">launch {launch:HH:mm:ss}</span> <span class="plan-fire">fires {fire:HH:mm:ss}</span> <span class="plan-join">join {joinFrom:HH:mm:ss}&ndash;{fire:HH:mm:ss}</span></div><div class="plan-slots">""");
                foreach (var slot in plan.Slots.Where(s => s.Wave == summary.Wave))
                {
                    double fillPct = slot.TroopCap > 0 ? (double)slot.FilledTroops / slot.TroopCap : 0;
                    var (ti, tc, ta) = TargetK(slot.RInf, slot.RCav, slot.RArc, slot.TroopCap);
                    sb.Append($"""<div class="plan-slot"><span class="plan-slot-lead">{Templates.E(slot.Lead)}</span><div class="plan-fill"><div class="plan-fill-bar" style="width:{Math.Min(100.0, fillPct * 100):0}%"></div></div><span class="plan-fill-text">{Templates.FmtK((int)slot.FilledTroops)}/{Templates.FmtK(slot.TroopCap)} &middot; {slot.FilledPlayers}/{slot.PlayerCap}</span><span class="plan-slot-target">target {ti}/{tc}/{ta}</span></div>""");
                }
                sb.Append("""</div>""");
                var over = summary.Demand > summary.Capacity ? """<span class="flag-warn">demand &gt; capacity</span>""" : "";
                sb.Append($"""<div class="plan-wave-summary">demand {summary.Demand} marches vs capacity {summary.Capacity} slots &middot; filled {summary.FilledSlots} slots / {Templates.FmtK((int)summary.FilledTroops)} troops {over}</div>""");
                sb.Append("""</div>""");
            }
            sb.Append("""</div>""");
        }

        // ── Participant table ──
        sb.Append("""<table class="plan-table"><thead><tr><th>Player</th><th>Pool</th><th>Q</th>""");
        for (int w = 0; w < WavePlanner.WaveCount; w++)
            sb.Append($"""<th>W{w}</th>""");
        sb.Append("""<th>Est. Damage</th><th>Band</th></tr></thead><tbody>""");

        foreach (var p in plan.Participants)
        {
            var badge = p.IsLead ? "&#9733; " : "";
            sb.Append($"""<tr class="plan-row{(p.IsLead ? " rally-lead" : "")}"><td class="plan-player">{badge}{Templates.E(p.Username)}</td><td class="plan-num">{Templates.FmtK(p.Pool)}</td><td class="plan-num">{p.Q}</td>""");
            for (int w = 0; w < WavePlanner.WaveCount; w++)
            {
                var rowAssigns = p.Assignments.Where(a => a.Wave == w).ToList();
                if (rowAssigns.Count == 0)
                {
                    sb.Append("""<td class="plan-miss">missed</td>""");
                    continue;
                }
                var parts = rowAssigns.Select(a =>
                    $"""<span class="plan-wassign">{Templates.E(a.Lead)} {Templates.FmtK(a.Inf)}/{Templates.FmtK(a.Cav)}/{Templates.FmtK(a.Arc)}</span>""");
                sb.Append($"""<td class="plan-assign">{string.Join(" ", parts)}</td>""");
            }
            sb.Append($"""<td class="plan-dmg">{p.EstDamage / 1_000_000:0.0}M <span class="plan-illustrative">(illustrative)</span></td>""");
            sb.Append($"""<td class="plan-band bracket-{p.Bracket}">{BandLabel(p.Bracket)}</td></tr>""");
        }
        sb.Append("""</tbody></table>""");

        // ── Footer: total capacity vs total demand ──
        sb.Append($"""<div class="plan-footer">Total capacity {Templates.FmtK((int)plan.TotalCapacity)} vs total demand {plan.TotalDemand} player-marches over {WavePlanner.WaveCount} waves</div>""");
        sb.Append("""</div>""");
        return sb.ToString();
    }

    static (string Inf, string Cav, string Arc) TargetK(double rInf, double rCav, double rArc, int troops)
        => (Templates.FmtK((int)(rInf * troops)),
            Templates.FmtK((int)(rCav * troops)),
            Templates.FmtK((int)(rArc * troops)));

    static string BandLabel(int bracket) => bracket switch
    {
        0 => "under 47M",
        1 => "47\u201390M",
        2 => "90\u2013175M",
        _ => "175M+"
    };
}
