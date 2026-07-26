using BearHunt.Data;
using BearHunt.Models;
using BearHunt;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;
using Microsoft.AspNetCore.DataProtection;
using StarFederation.Datastar.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents();
builder.Services.AddDatastar();
builder.Services.AddHttpContextAccessor();
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/data/keys"));
builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlite("Data Source=/data/bearhunt.db"));

// Ensure /data exists for SQLite and Data Protection keys (Fly.io persistent volume)
Directory.CreateDirectory("/data");

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // Migration: add Wave/IsRallyLead columns if missing
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Preferences ADD COLUMN Wave TEXT NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Preferences ADD COLUMN IsRallyLead INTEGER NOT NULL DEFAULT 0"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN PreferredBearWindow TEXT NOT NULL DEFAULT ''"); } catch { }
    // Allocator: rally leader stats + march count
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN InfantryAtkPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN InfantryLethalityPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN CavalryAtkPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN CavalryLethalityPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN ArcherAtkPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN ArcherLethalityPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN MarchCount INTEGER NOT NULL DEFAULT 0"); } catch { }
    try { db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS Jokes (Id INTEGER PRIMARY KEY AUTOINCREMENT, Text TEXT NOT NULL, CreatedAt TEXT NOT NULL)"); } catch { }
}

app.UseAntiforgery();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapRazorComponents<BearHunt.Components.App>();

// ─── API Endpoints ────────────────────────────────────────────

// POST /api/members/upsert — save/update member profile (standard form POST)
app.MapPost("/api/members/upsert", async (HttpRequest request, HttpResponse response, AppDbContext db) =>
{
    var username = GetUsername(request);

    if (string.IsNullOrEmpty(username))
    {
        response.Redirect("/bear-hunt/profile?error=Set+a+username+first");
        return;
    }

    var form = await request.ReadFormAsync();
    var member = await db.Members.FindAsync(username);
    if (member == null)
    {
        member = new Member { Username = username };
        db.Members.Add(member);
    }

    member.Infantry = ParseInt(form["infantry"]);
    member.Cavalry = ParseInt(form["cavalry"]);
    member.Archers = ParseInt(form["archers"]);
    member.RallyLeadHero = form["rallyLeadHero"].FirstOrDefault() ?? "";
    member.WidgetLevel = Math.Clamp(ParseInt(form["widgetLevel"], 3), 1, 5);
    member.RallySize = ParseInt(form["rallySize"]);
    member.SoloMarchSize = ParseInt(form["soloMarchSize"]);
    member.PreferredBearWindow = form["preferredBearWindow"].FirstOrDefault() ?? "";
    member.InfantryAtkPct = ParseNullableInt(form["infantryAtkPct"]);
    member.InfantryLethalityPct = ParseNullableInt(form["infantryLethalityPct"]);
    member.CavalryAtkPct = ParseNullableInt(form["cavalryAtkPct"]);
    member.CavalryLethalityPct = ParseNullableInt(form["cavalryLethalityPct"]);
    member.ArcherAtkPct = ParseNullableInt(form["archerAtkPct"]);
    member.ArcherLethalityPct = ParseNullableInt(form["archerLethalityPct"]);
    member.MarchCount = ParseInt(form["marchCount"]);
    member.UpdatedAt = DateTime.UtcNow;

    await db.SaveChangesAsync();
    response.Redirect("/bear-hunt/profile?saved=1");
}).DisableAntiforgery();

static int ParseInt(Microsoft.Extensions.Primitives.StringValues v, int fallback = 0) =>
    int.TryParse(v.FirstOrDefault(), out var n) ? Math.Max(0, n) : fallback;

static int? ParseNullableInt(Microsoft.Extensions.Primitives.StringValues v) =>
    int.TryParse(v.FirstOrDefault(), out var n) && n > 0 ? n : null;

// GET /api/roster — render all members as table rows
app.MapGet("/api/roster", async (IDatastarService sse, AppDbContext db) =>
{
    var members = await db.Members.OrderBy(m => m.Username).ToListAsync();

    var rows = string.Concat(members.Select(Templates.MemberRow));
    await sse.PatchElementsAsync($"""<tbody id="roster-rows">{rows}</tbody>""");
});

// GET /api/schedule — show next bear day with countdown and trap rosters
app.MapGet("/api/schedule", async (IDatastarService sse, AppDbContext db,
    HttpRequest request, IDataProtectionProvider protection) =>
{
    var cycle = await db.Cycles.FindAsync(1);
    if (cycle == null)
    {
        await sse.PatchElementsAsync("""<div id="schedule-cards"><p>No cycle configured yet.</p></div>""");
        return;
    }

    // Find the next cycle date (every 2 days from StartDate)
    var now = DateTime.UtcNow;
    var nextDate = cycle.StartDate;
    while (nextDate.Date < now.Date || (nextDate.Date == now.Date && nextDate.Date.Add(cycle.Trap2Time.ToTimeSpan()) <= now))
        nextDate = nextDate.AddDays(2);

    var members = await db.Members.ToDictionaryAsync(m => m.Username);
    var prefs = await db.Preferences.ToListAsync();
    var isAdmin = IsAdminAuthenticated(request, protection);
    var username = GetUsername(request);

    await sse.PatchElementsAsync($"""<div id="schedule-cards">{Templates.NextBearCard(nextDate, cycle, prefs, members, isAdmin, now, username)}</div>""");
});

// POST /api/preferences/upsert — save trap/time preference
app.MapPost("/api/preferences/upsert", async (IDatastarService sse, AppDbContext db, HttpRequest request) =>
{
    var username = GetUsername(request);

    if (string.IsNullOrEmpty(username))
    {
        await sse.PatchElementsAsync(Templates.Feedback("error", "Set a username first."));
        return;
    }

    var signals = await sse.ReadSignalsAsync<PreferenceSignals>();

    var existing = await db.Preferences
        .FirstOrDefaultAsync(p => p.Username == username);

    if (existing == null)
    {
        existing = new Preference { Username = username };
        db.Preferences.Add(existing);
    }

    existing.SelectedTrap = signals?.selectedTrap ?? "either";
    existing.Notes = signals?.notes ?? "";

    await db.SaveChangesAsync();

    // Re-render both trap rosters so signup appears immediately
    await ReRenderTrapRoster(sse, db, "1");
    await ReRenderTrapRoster(sse, db, "2");
});

// POST /api/preferences/remove — remove your signup
app.MapPost("/api/preferences/remove", async (IDatastarService sse, AppDbContext db, HttpRequest request) =>
{
    var username = GetUsername(request);
    if (string.IsNullOrEmpty(username)) return;

    var pref = await db.Preferences
        .FirstOrDefaultAsync(p => p.Username == username);

    if (pref is not null)
    {
        db.Preferences.Remove(pref);
        await db.SaveChangesAsync();
    }

    await ReRenderTrapRoster(sse, db, "1");
    await ReRenderTrapRoster(sse, db, "2");
});

// POST /api/cycles/upsert — admin sets/updates the cycle configuration
app.MapPost("/api/cycles/upsert", async (IDatastarService sse, AppDbContext db,
    HttpContext httpContext, IConfiguration config, IDataProtectionProvider protection) =>
{
    if (!IsAdminAuthenticated(httpContext.Request, protection))
    {
        httpContext.Response.StatusCode = 401;
        return;
    }
    var signals = await sse.ReadSignalsAsync<CycleSignals>();
    if (signals?.date == default)
    {
        await sse.PatchElementsAsync(Templates.Feedback("error", "Date is required."));
        return;
    }
    var cycle = await db.Cycles.FindAsync(1);
    if (cycle == null)
    {
        cycle = new Cycle { Id = 1 };
        db.Cycles.Add(cycle);
    }
    cycle.StartDate = signals!.date;
    cycle.Trap1Time = TimeOnly.Parse(signals.trap1Time);
    cycle.Trap2Time = TimeOnly.Parse(signals.trap2Time);
    await db.SaveChangesAsync();
    await sse.PatchElementsAsync(Templates.Feedback("success", "Cycle updated!"));
});

// GET /api/cycles/responses — show all signups
app.MapGet("/api/cycles/responses", async (IDatastarService sse, AppDbContext db) =>
{
    var prefs = await db.Preferences.ToListAsync();
    await sse.PatchElementsAsync(Templates.ResponsesTable(prefs));
});

// ─── Admin assignment endpoints ────────────────────────────────

// POST /api/admin/assign-wave — admin assigns wave to a signup
app.MapPost("/api/admin/assign-wave", async (IDatastarService sse, AppDbContext db,
    HttpRequest request, IDataProtectionProvider protection) =>
{
    if (!IsAdminAuthenticated(request, protection)) return;
    var signals = await sse.ReadSignalsAsync<WaveAssignSignals>();
    if (signals is null) return;

    var pref = await db.Preferences.FindAsync(signals.prefId);
    if (pref is null) return;

    pref.Wave = string.IsNullOrEmpty(signals.wave) ? null : signals.wave;
    await db.SaveChangesAsync();

    await ReRenderTrapRoster(sse, db, pref.SelectedTrap, true);
});

// POST /api/admin/toggle-rally-lead — admin toggles rally lead on a signup
app.MapPost("/api/admin/toggle-rally-lead", async (IDatastarService sse, AppDbContext db,
    HttpRequest request, IDataProtectionProvider protection) =>
{
    if (!IsAdminAuthenticated(request, protection)) return;
    var signals = await sse.ReadSignalsAsync<RallyLeadToggleSignals>();
    if (signals is null) return;

    var pref = await db.Preferences.FindAsync(signals.prefId);
    if (pref is null) return;

    pref.IsRallyLead = !pref.IsRallyLead;
    await db.SaveChangesAsync();

    await ReRenderTrapRoster(sse, db, pref.SelectedTrap, true);
});


// DEBUG: check DB contents
app.MapGet("/api/debug/db", async (AppDbContext db) =>
{
    var members = await db.Members.ToListAsync();
    var prefs = await db.Preferences.ToListAsync();
    var cycles = await db.Cycles.ToListAsync();
    return Results.Ok(new { memberCount = members.Count, prefCount = prefs.Count, cycleCount = cycles.Count,
        firstMember = members.FirstOrDefault()?.Username, firstPref = prefs.FirstOrDefault()?.Username });
});

// SEED: populate test data via EF
app.MapGet("/api/debug/seed", async (AppDbContext db) =>
{
    // Clear existing
    db.Members.RemoveRange(db.Members);
    db.Preferences.RemoveRange(db.Preferences);
    db.Cycles.RemoveRange(db.Cycles);
    await db.SaveChangesAsync();

    // Members
    var ms = new[] {
        new Member { Username="Deydotci", Infantry=800000, Cavalry=600000, Archers=400000, RallyLeadHero="Molly", WidgetLevel=4, RallySize=900000, SoloMarchSize=450000, InfantryAtkPct=1200, InfantryLethalityPct=800, CavalryAtkPct=800, CavalryLethalityPct=600, ArcherAtkPct=1000, ArcherLethalityPct=700, MarchCount=6 },
        new Member { Username="Leo", Infantry=600000, Cavalry=700000, Archers=500000, RallyLeadHero="Flint", WidgetLevel=3, RallySize=700000, SoloMarchSize=350000, InfantryAtkPct=1000, InfantryLethalityPct=700, CavalryAtkPct=500, CavalryLethalityPct=400, ArcherAtkPct=700, ArcherLethalityPct=500, MarchCount=5 },
        new Member { Username="Ivy", Infantry=500000, Cavalry=500000, Archers=800000, RallyLeadHero="Jeronimo", WidgetLevel=5, RallySize=700000, SoloMarchSize=400000, InfantryAtkPct=800, InfantryLethalityPct=600, CavalryAtkPct=600, CavalryLethalityPct=450, ArcherAtkPct=1200, ArcherLethalityPct=800, MarchCount=5 },
        new Member { Username="Alice", Infantry=800000, Cavalry=600000, Archers=400000, RallyLeadHero="Natalia", WidgetLevel=4, RallySize=900000, SoloMarchSize=400000, InfantryAtkPct=900, InfantryLethalityPct=650, CavalryAtkPct=700, CavalryLethalityPct=500, ArcherAtkPct=800, ArcherLethalityPct=550, MarchCount=5 },
        new Member { Username="Mia", Infantry=400000, Cavalry=800000, Archers=600000, RallyLeadHero="Jasser", WidgetLevel=3, RallySize=800000, SoloMarchSize=350000, InfantryAtkPct=700, InfantryLethalityPct=500, CavalryAtkPct=900, CavalryLethalityPct=650, ArcherAtkPct=750, ArcherLethalityPct=550, MarchCount=4 },
        new Member { Username="Frank", Infantry=500000, Cavalry=600000, Archers=700000, RallyLeadHero="Alonso", WidgetLevel=5, RallySize=800000, SoloMarchSize=400000, InfantryAtkPct=750, InfantryLethalityPct=550, CavalryAtkPct=700, CavalryLethalityPct=500, ArcherAtkPct=900, ArcherLethalityPct=650, MarchCount=4 },

        new Member { Username="Grace", Infantry=700000, Cavalry=400000, Archers=700000, RallyLeadHero="Natalia", WidgetLevel=4, RallySize=850000, SoloMarchSize=400000, InfantryAtkPct=850, InfantryLethalityPct=600, CavalryAtkPct=500, CavalryLethalityPct=400, ArcherAtkPct=950, ArcherLethalityPct=700, MarchCount=5 },
        new Member { Username="Jack", Infantry=600000, Cavalry=700000, Archers=500000, RallyLeadHero="Flint", WidgetLevel=3, RallySize=850000, SoloMarchSize=350000, InfantryAtkPct=800, InfantryLethalityPct=600, CavalryAtkPct=600, CavalryLethalityPct=450, ArcherAtkPct=800, ArcherLethalityPct=550, MarchCount=5 },
        new Member { Username="Henry", Infantry=750000, Cavalry=450000, Archers=600000, RallyLeadHero="Jeronimo", WidgetLevel=5, RallySize=750000, SoloMarchSize=400000, InfantryAtkPct=750, InfantryLethalityPct=550, CavalryAtkPct=550, CavalryLethalityPct=400, ArcherAtkPct=700, ArcherLethalityPct=500, MarchCount=4 },
        new Member { Username="Kate", Infantry=500000, Cavalry=600000, Archers=700000, RallyLeadHero="Molly", WidgetLevel=4, RallySize=800000, SoloMarchSize=350000, InfantryAtkPct=700, InfantryLethalityPct=500, CavalryAtkPct=700, CavalryLethalityPct=500, ArcherAtkPct=600, ArcherLethalityPct=450, MarchCount=4 },
        new Member { Username="Bob", Infantry=500000, Cavalry=400000, Archers=700000, RallyLeadHero="Jasser", WidgetLevel=3, SoloMarchSize=500000, MarchCount=5 },
        new Member { Username="Charlie", Infantry=1000000, Cavalry=300000, Archers=200000, RallyLeadHero="Alonso", WidgetLevel=4, RallySize=800000, SoloMarchSize=500000, InfantryAtkPct=1000, InfantryLethalityPct=700, CavalryAtkPct=400, CavalryLethalityPct=300, ArcherAtkPct=600, ArcherLethalityPct=400, MarchCount=5 },
        new Member { Username="Diana", Infantry=300000, Cavalry=900000, Archers=500000, RallyLeadHero="Natalia", WidgetLevel=3, SoloMarchSize=450000, MarchCount=4 },
    };
    db.Members.AddRange(ms);

    // Preferences: Trap 1 (10 leaders + Bob), Trap 2 (1 leader + Diana)
    var ps = new List<Preference>();
    foreach (var u in new[]{"Deydotci","Leo","Ivy","Alice","Mia","Frank","Grace","Jack","Henry","Kate"})
        ps.Add(new Preference { Username=u, SelectedTrap="1", IsRallyLead=true });
    ps.Add(new Preference { Username="Bob", SelectedTrap="1" });
    ps.Add(new Preference { Username="Charlie", SelectedTrap="2", IsRallyLead=true });
    ps.Add(new Preference { Username="Diana", SelectedTrap="2" });
    db.Preferences.AddRange(ps);

    db.Cycles.Add(new Cycle { Id=1, StartDate=new DateTime(2026,7,25), Trap1Time=new TimeOnly(19,0), Trap2Time=new TimeOnly(23,0) });
    await db.SaveChangesAsync();

    return Results.Ok(new { members=ms.Length, prefs=ps.Count, msg="Seeded via EF" });
});
// GET /api/admin/allocator — compute optimal splits for both traps
app.MapGet("/api/admin/allocator", async (
    IDatastarService sse, AppDbContext db, HttpRequest request,
    IDataProtectionProvider protection) =>
{
    if (!IsAdminAuthenticated(request, protection)) return;

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
// POST /api/profile/username — set/change username cookie
app.MapPost("/api/profile/username", async (HttpRequest request, HttpResponse response, AppDbContext db) =>
{
    var form = await request.ReadFormAsync();
    var newUsername = form["username"].FirstOrDefault()?.Trim() ?? "";

    if (string.IsNullOrEmpty(newUsername))
    {
        response.StatusCode = 400;
        return;
    }

    var oldUsername = GetUsername(request);

    // If changing username, migrate data
    if (oldUsername != null && !string.Equals(oldUsername, newUsername, StringComparison.OrdinalIgnoreCase))
    {
        var oldMember = await db.Members.FindAsync(oldUsername);
        if (oldMember != null)
        {
            var newMember = await db.Members.FindAsync(newUsername) ?? new Member { Username = newUsername };
            if (newMember.UpdatedAt == default)
            {
                newMember.Infantry = oldMember.Infantry;
                newMember.Cavalry = oldMember.Cavalry;
                newMember.Archers = oldMember.Archers;
                newMember.RallyLeadHero = oldMember.RallyLeadHero;
                newMember.WidgetLevel = oldMember.WidgetLevel;
                newMember.RallySize = oldMember.RallySize;
                newMember.SoloMarchSize = oldMember.SoloMarchSize;
                newMember.Role = oldMember.Role;
                newMember.UpdatedAt = DateTime.UtcNow;
                db.Members.Add(newMember);
            }

            // Migrate preferences
            var prefs = await db.Preferences.Where(p => p.Username == oldUsername).ToListAsync();
            foreach (var p in prefs)
                p.Username = newUsername;

            db.Members.Remove(oldMember);
        }
    }
    else if (oldUsername == null)
    {
        // First time: ensure a member row exists
        if (await db.Members.FindAsync(newUsername) == null)
            db.Members.Add(new Member { Username = newUsername, UpdatedAt = DateTime.UtcNow });
    }

    await db.SaveChangesAsync();

    response.Cookies.Append("kh_username", newUsername, new CookieOptions
    {
        SameSite = SameSiteMode.Strict,
        Expires = DateTimeOffset.UtcNow.AddDays(365)
    });
    response.Redirect("/bear-hunt/profile");
}).DisableAntiforgery();


// ─── Auth Endpoints ────────────────────────────────────────────

// POST /api/admin/login — validate password, set auth cookie
app.MapPost("/api/admin/login", (HttpRequest request, HttpResponse response,
    IConfiguration config, IDataProtectionProvider protection) =>
{
    var password = request.Form["password"].FirstOrDefault();
    var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? config["AdminPassword"];
    if (password == adminPassword)
    {
        var protector = protection.CreateProtector("bh-admin-auth")
            .ToTimeLimitedDataProtector();
        var token = protector.Protect("authenticated", TimeSpan.FromHours(8));
        response.Cookies.Append("bh_admin", token, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(8)
        });
    }
    else
    {
        response.Redirect("/bear-hunt/admin?error=Wrong%20password");
        return Task.CompletedTask;
    }
    response.Redirect("/bear-hunt/admin");
    return Task.CompletedTask;
}).DisableAntiforgery();

// POST /api/admin/logout — clear auth cookie
app.MapPost("/api/admin/logout", (HttpResponse response) =>
{
    response.Cookies.Delete("bh_admin");
    response.Redirect("/bear-hunt/admin");
    return Task.CompletedTask;
}).DisableAntiforgery();

// ─── Joke Endpoints ─────────────────────────────────────────

// GET /api/jokes/random — patches splashText signal (1/3 chance of a joke)
app.MapGet("/api/jokes/random", async (IDatastarService sse, AppDbContext db) =>
{
    if (Random.Shared.Next(3) != 0)
    {
        await sse.PatchSignalsAsync(new { splashText = "" });
        return;
    }
    var count = await db.Jokes.CountAsync();
    if (count == 0)
    {
        await sse.PatchSignalsAsync(new { splashText = "" });
        return;
    }
    var skip = Random.Shared.Next(count);
    var joke = await db.Jokes.OrderBy(j => j.Id).Skip(skip).FirstAsync();
    await sse.PatchSignalsAsync(new { splashText = joke.Text });
});

// GET /api/jokes — list all jokes as HTML fragment (admin only)
app.MapGet("/api/jokes", async (AppDbContext db, HttpRequest request, IDataProtectionProvider protection) =>
{
    if (!IsAdminAuthenticated(request, protection))
        return Results.Unauthorized();
    var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
    return Results.Content(Templates.JokeList(jokes), "text/html");
});

// POST /api/jokes — add a joke (admin only)
app.MapPost("/api/jokes", async (IDatastarService sse, AppDbContext db, HttpRequest request, IDataProtectionProvider protection) =>
{
    if (!IsAdminAuthenticated(request, protection))
    {
        await sse.PatchElementsAsync(Templates.Feedback("error", "Unauthorized."));
        return;
    }
    var signals = await sse.ReadSignalsAsync<JokeSignals>();
    var text = signals?.text?.Trim();
    if (string.IsNullOrWhiteSpace(text))
    {
        await sse.PatchElementsAsync(Templates.Feedback("error", "Text is required."));
        return;
    }
    db.Jokes.Add(new Joke { Text = text, CreatedAt = DateTime.UtcNow });
    await db.SaveChangesAsync();
    var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
    await sse.PatchElementsAsync($"""<div id="joke-list">{Templates.JokeList(jokes)}</div>""");
});

// DELETE /api/jokes/{id} — delete a joke (admin only)
app.MapDelete("/api/jokes/{id:int}", async (int id, IDatastarService sse, AppDbContext db, HttpRequest request, IDataProtectionProvider protection) =>
{
    if (!IsAdminAuthenticated(request, protection))
        return;
    var joke = await db.Jokes.FindAsync(id);
    if (joke is not null)
    {
        db.Jokes.Remove(joke);
        await db.SaveChangesAsync();
    }
    var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
    await sse.PatchElementsAsync($"""<div id="joke-list">{Templates.JokeList(jokes)}</div>""");
});
// ─── Auth Helper ───────────────────────────────────────────────

static bool IsAdminAuthenticated(HttpRequest request, IDataProtectionProvider protection)
{
    if (!request.Cookies.TryGetValue("bh_admin", out var cookie))
        return false;
    try
    {
        var protector = protection.CreateProtector("bh-admin-auth")
            .ToTimeLimitedDataProtector();
        protector.Unprotect(cookie);
        return true;
    }
    catch
    {
        return false;
    }
}
// ─── Profile Helper ──────────────────────────────────────────────

static string? GetUsername(HttpRequest request) =>
    request.Cookies.TryGetValue("kh_username", out var u) ? u : null;

// ─── Schedule Helper ─────────────────────────────────────────────

static async Task ReRenderTrapRoster(IDatastarService sse, AppDbContext db,
    string trap, bool isAdmin = false)
{
    var cycle = await db.Cycles.FindAsync(1);
    if (cycle is null) return;

    var trapTime = trap == "1" ? cycle.Trap1Time : cycle.Trap2Time;
    var prefs = await db.Preferences
        .Where(p => p.SelectedTrap == trap || p.SelectedTrap == "either")
        .ToListAsync();
    var members = await db.Members.ToDictionaryAsync(m => m.Username);

    await sse.PatchElementsAsync(Templates.TrapRosterSection(trap, trapTime, prefs, members, isAdmin));
}

app.Run();

// ─── Signal DTOs ──────────────────────────────────────────────
record PreferenceSignals(string selectedTrap, string? preferredTime, string notes);
record CycleSignals(DateTime date, string trap1Time, string trap2Time);
record WaveAssignSignals(int prefId, string wave);
record RallyLeadToggleSignals(int prefId);
record RemoveSignals();
record JokeSignals(string text);

record LeaderInfo(string Username, double K, double RInf, double RCav, double RArc, int RallyCapacity);

