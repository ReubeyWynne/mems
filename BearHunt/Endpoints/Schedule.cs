using BearHunt.Data;
using BearHunt.Helpers;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class ScheduleEndpoints
{
    public static void Map(WebApplication app)
    {
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
            var isAdmin = AuthHelper.IsAdminAuthenticated(request, protection);
            var username = AuthHelper.GetUsername(request);

            await sse.PatchElementsAsync($"""<div id="schedule-cards">{Templates.NextBearCard(nextDate, cycle, prefs, members, isAdmin, now, username)}</div>""");
        });
    }
}
