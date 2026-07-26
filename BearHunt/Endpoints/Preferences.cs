using BearHunt.Data;
using BearHunt.Components.Fragments;
using BearHunt.Helpers;
using BearHunt.Models;
using BearHunt.Services;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class PreferencesEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/preferences/upsert", async (IDatastarService sse, AppDbContext db,
            HttpRequest request, RazorRenderer renderer) =>
        {
            var username = AuthHelper.GetUsername(request);

            if (string.IsNullOrEmpty(username))
            {
                var fb = await renderer.RenderAsync<Feedback>(parms =>
                {
                    parms[nameof(Feedback.Type)] = "error";
                    parms[nameof(Feedback.Message)] = "Set a username first.";
                });
                await sse.PatchElementsAsync(fb);
                return;
            }

            var form = await request.ReadFormAsync();

            var existing = await db.Preferences
                .FirstOrDefaultAsync(p => p.Username == username);

            if (existing == null)
            {
                existing = new Preference { Username = username };
                db.Preferences.Add(existing);
            }

            existing.SelectedTrap = form["selectedTrap"].FirstOrDefault() ?? "either";
            existing.Notes = form["notes"].FirstOrDefault() ?? "";

            await db.SaveChangesAsync();

            await ReRenderTrapRoster(sse, db, renderer, "1");
            await ReRenderTrapRoster(sse, db, renderer, "2");
        });

        app.MapPost("/api/preferences/remove", async (IDatastarService sse, AppDbContext db,
            HttpRequest request, RazorRenderer renderer) =>
        {
            var username = AuthHelper.GetUsername(request);
            if (string.IsNullOrEmpty(username)) return;

            var pref = await db.Preferences
                .FirstOrDefaultAsync(p => p.Username == username);

            if (pref is not null)
            {
                db.Preferences.Remove(pref);
                await db.SaveChangesAsync();
            }

            await ReRenderTrapRoster(sse, db, renderer, "1");
            await ReRenderTrapRoster(sse, db, renderer, "2");
        });
    }

    static async Task ReRenderTrapRoster(IDatastarService sse, AppDbContext db,
        RazorRenderer renderer, string trap, bool isAdmin = false)
    {
        var cycle = await db.Cycles.FindAsync(1);
        if (cycle is null) return;

        var now = DateTime.UtcNow;
        var nextDate = cycle.StartDate;
        while (nextDate.Date < now.Date || (nextDate.Date == now.Date && nextDate.Date.Add(cycle.Trap2Time.ToTimeSpan()) <= now))
            nextDate = nextDate.AddDays(2);

        var trapTime = trap == "1" ? cycle.Trap1Time : cycle.Trap2Time;
        var prefs = await db.Preferences
            .Where(p => p.SelectedTrap == trap || p.SelectedTrap == "either")
            .ToListAsync();
        var members = await db.Members.ToDictionaryAsync(m => m.Username);

        var html = await renderer.RenderAsync<TrapRosterSection>(parms =>
        {
            parms[nameof(TrapRosterSection.Trap)] = trap;
            parms[nameof(TrapRosterSection.TrapTime)] = trapTime;
            parms[nameof(TrapRosterSection.NextDate)] = nextDate;
            parms[nameof(TrapRosterSection.Prefs)] = prefs;
            parms[nameof(TrapRosterSection.Members)] = members;
            parms[nameof(TrapRosterSection.IsAdmin)] = isAdmin;
        });
        await sse.PatchElementsAsync(html);
    }
}
