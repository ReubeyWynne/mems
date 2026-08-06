using BearHunt.Data;
using BearHunt.Components.Fragments;
using BearHunt.Helpers;
using BearHunt.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class ScheduleEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/schedule", async (IDatastarService sse, AppDbContext db,
            HttpRequest request, IDataProtectionProvider protection, RazorRenderer renderer) =>
        {
            var cycle = await db.Cycles.FindAsync(1);
            if (cycle == null)
            {
                await sse.PatchElementsAsync("""<div id="schedule-cards"><p>No cycle configured yet.</p></div>""");
                return;
            }

            var now = DateTime.UtcNow;
            var nextDate = cycle.StartDate;
            while (nextDate.Date < now.Date || (nextDate.Date == now.Date && nextDate.Date.Add(cycle.Trap2Time.ToTimeSpan()) <= now))
                nextDate = nextDate.AddDays(2);

            var members = await db.Members.ToDictionaryAsync(m => m.Username);
            var prefs = await db.Preferences.ToListAsync();
            var isAdmin = AuthHelper.IsAdminAuthenticated(request, protection);
            var username = AuthHelper.GetUsername(request);

            var html = await renderer.RenderAsync<NextBearCard>(parms =>
            {
                parms[nameof(NextBearCard.NextDate)] = nextDate;
                parms[nameof(NextBearCard.Cycle)] = cycle;
                parms[nameof(NextBearCard.Prefs)] = prefs;
                parms[nameof(NextBearCard.Members)] = members;
                parms[nameof(NextBearCard.IsAdmin)] = isAdmin;
                parms[nameof(NextBearCard.Now)] = now;
                parms[nameof(NextBearCard.Username)] = username;
            });
            await sse.PatchElementsAsync(html);
        });
    }
}
