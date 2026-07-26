using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class PreferencesEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/preferences/upsert", async (IDatastarService sse, AppDbContext db, HttpRequest request) =>
        {
            var username = AuthHelper.GetUsername(request);

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
            await Templates.ReRenderTrapRoster(sse, db, "1");
            await Templates.ReRenderTrapRoster(sse, db, "2");
        });

        app.MapPost("/api/preferences/remove", async (IDatastarService sse, AppDbContext db, HttpRequest request) =>
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

            await Templates.ReRenderTrapRoster(sse, db, "1");
            await Templates.ReRenderTrapRoster(sse, db, "2");
        });
    }
}
