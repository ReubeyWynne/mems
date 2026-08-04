using BearHunt.Data;
using BearHunt.Components.Fragments;
using BearHunt.Helpers;
using BearHunt.Models;
using BearHunt.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class CyclesEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/cycles/upsert", async (IDatastarService sse, AppDbContext db,
            HttpRequest request, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection))
            {
                request.HttpContext.Response.StatusCode = 401;
                return;
            }
            var form = await request.ReadFormAsync();
            var dateStr = form["date"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(dateStr) || !DateTime.TryParse(dateStr, out var date))
            {
                await sse.PatchElementsAsync(
                    """<div id="feedback" class="feedback feedback--error">Date is required.</div>""");
                return;
            }
            var cycle = await db.Cycles.FindAsync(1);
            if (cycle == null)
            {
                cycle = new Cycle { Id = 1 };
                db.Cycles.Add(cycle);
            }
            cycle.StartDate = date;
            var trap1Str = form["trap1Time"].FirstOrDefault();
            var trap2Str = form["trap2Time"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(trap1Str) && TimeOnly.TryParse(trap1Str, out var t1))
                cycle.Trap1Time = t1;
            if (!string.IsNullOrWhiteSpace(trap2Str) && TimeOnly.TryParse(trap2Str, out var t2))
                cycle.Trap2Time = t2;
            await db.SaveChangesAsync();
            await sse.PatchElementsAsync(
                """<div id="feedback" class="feedback feedback--success">Cycle updated!</div>""");
        }).DisableAntiforgery();

        app.MapGet("/api/cycles/responses", async (IDatastarService sse, AppDbContext db, RazorRenderer renderer) =>
        {
            var prefs = await db.Preferences.ToListAsync();
            var html = await renderer.RenderAsync<ResponsesTable>(parms =>
            {
                parms[nameof(ResponsesTable.Prefs)] = prefs;
            });
            await sse.PatchElementsAsync(html);
        });
    }
}
