using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using BearHunt.Components.Fragments;
using BearHunt.Services;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class WavePlannerEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/admin/planner", async (
            IDatastarService sse, AppDbContext db, HttpRequest request,
            IDataProtectionProvider protection, IConfiguration config, RazorRenderer renderer) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection)) return;
            var cycle = await db.Cycles.FindAsync(1);
            var prefs = await db.Preferences.ToListAsync();
            var members = await db.Members.ToDictionaryAsync(m => m.Username);
            double calibration = double.TryParse(config["Bear:Calibration"], out var d) ? d : 1.0;

            TrapPlan? plan1 = null, plan2 = null;
            if (cycle != null)
            {
                plan1 = WavePlanner.BuildPlan("1", cycle.Trap1Time, members, prefs, calibration);
                plan2 = WavePlanner.BuildPlan("2", cycle.Trap2Time, members, prefs, calibration);
            }

            var html = await renderer.RenderAsync<PlannerResults>(parms =>
            {
                parms[nameof(PlannerResults.Plan1)] = plan1;
                parms[nameof(PlannerResults.Plan2)] = plan2;
            });
            await sse.PatchElementsAsync(html);
        });
    }
}
