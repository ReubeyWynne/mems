using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;
using StarFederation.Datastar.DependencyInjection;

namespace BearHunt.Endpoints;

public static class CyclesEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/cycles/upsert", async (IDatastarService sse, AppDbContext db,
            HttpContext httpContext, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(httpContext.Request, protection))
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

        app.MapGet("/api/cycles/responses", async (IDatastarService sse, AppDbContext db) =>
        {
            var prefs = await db.Preferences.ToListAsync();
            await sse.PatchElementsAsync(Templates.ResponsesTable(prefs));
        });
    }
}
