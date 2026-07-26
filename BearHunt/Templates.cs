namespace BearHunt;

using BearHunt.Models;
using BearHunt.Data;
using Microsoft.EntityFrameworkCore;
public static class Templates
{
    public static string E(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");
    public static string FmtK(int n) => n switch
    {
        < 1000 => n.ToString(),
        _ => (n / 1000f) % 1 == 0 ? $"{n / 1000}k" : $"{n / 1000f:F1}k"
    };
    public static string Feedback(string type, string message)
    {
        var cls = type == "error" ? "feedback-error" : "feedback-success";
        return $"""<div id="feedback" class="{cls}">{E(message)}</div>""";
    }

    public static string MemberRow(Member m)
    {
        string formation = (m.Infantry + m.Cavalry + m.Archers) == 0
            ? "\u2014"
            : $"{m.Infantry * 100 / (m.Infantry + m.Cavalry + m.Archers)}/{m.Cavalry * 100 / (m.Infantry + m.Cavalry + m.Archers)}/{m.Archers * 100 / (m.Infantry + m.Cavalry + m.Archers)}";
        return $"""
            <tr id="member-{E(m.Username)}">
                <td>{E(m.Username)}</td>
                <td>{FmtK(m.Infantry)} / {FmtK(m.Cavalry)} / {FmtK(m.Archers)} ({formation})</td>
                <td>{E(m.RallyLeadHero)} (Lv{m.WidgetLevel})</td>
                <td>{FmtK(m.RallySize)}</td>
                <td>{FmtK(m.SoloMarchSize)}</td>
            </tr>
            """;
    }

    // ─── Next bear day card ───────────────────────────────────────

    public static string NextBearCard(DateTime nextDate, Cycle cycle,
        List<Preference> prefs, Dictionary<string, Member> members, bool isAdmin, DateTime now, string? username)
    {
        var trap1Prefs = prefs.Where(p => p.SelectedTrap is "1" or "either").ToList();
        var trap2Prefs = prefs.Where(p => p.SelectedTrap is "2" or "either").ToList();
        var myPref = prefs.FirstOrDefault(p => string.Equals(p.Username, username, StringComparison.OrdinalIgnoreCase));

        // Countdown to Trap 1
        var target = nextDate.Date.Add(cycle.Trap1Time.ToTimeSpan());
        var remaining = target - now;
        string countdown;
        if (remaining.TotalSeconds <= 0)
        {
            target = nextDate.Date.Add(cycle.Trap2Time.ToTimeSpan());
            remaining = target - now;
            if (remaining.TotalSeconds <= 0)
                countdown = "<span class=\"countdown-live\">LIVE</span>";
            else if (remaining.TotalHours < 1)
                countdown = $"<span class=\"countdown-label\">T2 in</span> {remaining.Minutes}m";
            else
                countdown = $"<span class=\"countdown-label\">T2 in</span> {remaining.Hours}h {remaining.Minutes}m";
        }
        else if (remaining.TotalHours < 1)
            countdown = $"{remaining.Minutes}m <span class=\"countdown-label\">remaining</span>";
        else
            countdown = $"{remaining.Hours}h {remaining.Minutes}m <span class=\"countdown-label\">remaining</span>";

        var buttonText = myPref != null ? "Update" : "Sign Up";
        var removeButton = myPref != null
            ? """<button data-on:click="&#64;post('/api/preferences/remove')" class="btn-remove">Remove</button>"""
            : "";

        return $$"""
            <div id="next-bear" class="next-bear-card">
                <div class="bear-banner">
                    <div class="bear-date-block">
                        <span class="bear-label">NEXT BEAR HUNT</span>
                        <span class="bear-date">{{nextDate:dddd, MMMM d}}</span>
                    </div>
                    <div class="bear-countdown">{{countdown}}</div>
                </div>
                <div class="bear-rosters">
                    {{TrapRosterSection("1", cycle.Trap1Time, trap1Prefs, members, isAdmin)}}
                </div>
                <div class="bear-rosters">
                    {{TrapRosterSection("2", cycle.Trap2Time, trap2Prefs, members, isAdmin)}}
                </div>
                <div class="bear-signup"
                     data-signals="{ selectedTrap: '{{myPref?.SelectedTrap ?? "either"}}', notes: '{{E(myPref?.Notes ?? "")}}' }">
                    <div class="signup-row">
                        <select data-bind:selectedTrap>
                            <option value="either">Either trap</option>
                            <option value="1">Trap 1</option>
                            <option value="2">Trap 2</option>
                        </select>
                        <input type="text" data-bind:notes placeholder="Notes (optional)" />
                        <button data-on:click="&#64;post('/api/preferences/upsert')">{{buttonText}}</button>
                        {{removeButton}}
                    </div>
                </div>
            </div>
            """;
    }

    public static string TrapRosterSection(string trap, TimeOnly trapTime,
        List<Preference> prefs, Dictionary<string, Member> members, bool isAdmin)
    {
        var sectionId = $"trap-roster-{trap}";
        var count = prefs.Count;

        var sb = new System.Text.StringBuilder();
        sb.Append($$"""<div id="{{sectionId}}" class="trap-roster trap-{{trap}}">""");
        sb.Append($$"""<div class="trap-header"><span class="trap-label">Trap {{trap}}</span><span class="trap-time">{{trapTime:HH:mm}}</span><span class="trap-count">{{count}}</span></div>""");

        if (count == 0)
        {
            sb.Append("""<p class="trap-empty">No signups yet.</p>""");
        }
        else
        {
            sb.Append("""<table class="trap-table"><thead><tr>""");
            sb.Append("""<th>Player</th><th>I/C/A</th><th>March</th><th>Hero</th>""");
            if (isAdmin) sb.Append("""<th>Wave</th>""");
            sb.Append("""</tr></thead><tbody>""");

            foreach (var p in prefs.OrderBy(p => p.Username))
            {
                members.TryGetValue(p.Username, out var m);
                sb.Append(TrapRosterRow(p, m, isAdmin));
            }
            sb.Append("""</tbody></table>""");
        }
        sb.Append("""</div>""");
        return sb.ToString();
    }

    static string TrapRosterRow(Preference p, Member? m, bool isAdmin)
    {
        var username = E(p.Username);
        string troops, hero, march;

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
                var ifmt = FmtK(m.Infantry);
                var cfmt = FmtK(m.Cavalry);
                var afmt = FmtK(m.Archers);
                troops = $"{ifmt}/{cfmt}/{afmt} <span class=\"formation\">({i}/{c}/{a})</span>";
            }
            march = m.RallySize > 0
                ? FmtK(m.RallySize)
                : m.SoloMarchSize > 0 ? $"{FmtK(m.SoloMarchSize)}s" : "\u2014";
            hero = !string.IsNullOrEmpty(m.RallyLeadHero)
                ? $"{E(m.RallyLeadHero)} <span class=\"hero-lv\">Lv{m.WidgetLevel}</span>"
                : "\u2014";
        }
        else
        {
            troops = "\u2014";
            march = "\u2014";
            hero = "\u2014";
        }

        var rallyBadge = p.IsRallyLead ? """ <span class="rally-badge" title="Rally Lead">&#9733;</span>""" : "";

        var row = $"""
            <tr id="pref-{p.Id}" class="trap-row{(p.IsRallyLead ? " rally-lead" : "")}">
                <td>{username}{rallyBadge}</td>
                <td class="troops-col">{troops}</td>
                <td class="march-col">{march}</td>
                <td class="hero-col">{hero}</td>
            """;

        if (isAdmin)
        {
            var waveRaw = p.Wave ?? "";
            var rlClass = p.IsRallyLead ? " active" : "";
            var sel = (string v) => waveRaw == v ? " selected" : "";

            var wavePost = $"&#64;post('/api/admin/assign-wave', {{ payload: {{ prefId: {p.Id}, wave: evt.target.value }} }})";
            var rlPost = $"&#64;post('/api/admin/toggle-rally-lead', {{ payload: {{ prefId: {p.Id} }} }})";

            row += $"""
                <td class="wave-col">
                    <div class="admin-controls">
                        <select data-on:change="{wavePost}" class="wave-select">
                            <option value=""{sel("")}>--</option>
                            <option value="0"{sel("0")}>W0</option>
                            <option value="1"{sel("1")}>W1</option>
                            <option value="2"{sel("2")}>W2</option>
                            <option value="3"{sel("3")}>W3</option>
                            <option value="reserves"{sel("reserves")}>Reserves</option>
                        </select>
                        <button data-on:click="{rlPost}"
                                class="rl-toggle{rlClass}"
                                title="Toggle Rally Lead">RL</button>
                    </div>
                </td>
                """;
        }

        row += "\n            </tr>";
        return row;
    }

    // ─── Legacy responses table (kept for API compat) ────────────

    public static string ResponsesTable(IEnumerable<Preference> prefs)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append("""<div id="responses">""");
        if (!prefs.Any())
        {
            sb.Append("""<p>No responses yet.</p>""");
        }
        else
        {
            sb.Append("""<table><thead><tr><th>Member</th><th>Trap</th><th>Time</th><th>Notes</th></tr></thead><tbody>""");
            foreach (var p in prefs)
            {
                sb.Append($"""<tr><td>{E(p.Username)}</td><td>{E(p.SelectedTrap)}</td><td>{p.PreferredTime?.ToString("HH:mm") ?? "\u2014"}</td><td>{E(p.Notes)}</td></tr>""");
            }
            sb.Append("""</tbody></table>""");
        }
        sb.Append("""</div>""");
        return sb.ToString();
    }

    public static string JokeList(IEnumerable<Joke> jokes)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append("""<table class="joke-table"><thead><tr><th>Text</th><th>Added</th><th></th></tr></thead><tbody>""");
        foreach (var j in jokes)
        {
            sb.Append($"""<tr id="joke-{j.Id}"><td>{E(j.Text)}</td><td>{j.CreatedAt:yyyy-MM-dd}</td><td><button data-on:click="&#64;delete('/api/jokes/{j.Id}')" class="btn-delete">Delete</button></td></tr>""");
        }
        sb.Append("""</tbody></table>""");
        return sb.ToString();
    }

    public static async Task ReRenderTrapRoster(IDatastarService sse, AppDbContext db,
        string trap, bool isAdmin = false)
    {
        var cycle = await db.Cycles.FindAsync(1);
        if (cycle is null) return;

        var trapTime = trap == "1" ? cycle.Trap1Time : cycle.Trap2Time;
        var prefs = await db.Preferences
            .Where(p => p.SelectedTrap == trap || p.SelectedTrap == "either")
            .ToListAsync();
        var members = await db.Members.ToDictionaryAsync(m => m.Username);

        await sse.PatchElementsAsync(TrapRosterSection(trap, trapTime, prefs, members, isAdmin));
    }
}
