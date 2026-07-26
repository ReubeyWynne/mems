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
            HttpContext httpContext, IDataProtectionProvider protection, RazorRenderer renderer) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(httpContext.Request, protection))
            {
                httpContext.Response.StatusCode = 401;
                return;
            }
            var form = await httpContext.Request.ReadFormAsync();
            var dateStr = form["date"].FirstOrDefault();
            if (string.IsNullOrEmpty(dateStr) || !DateTime.TryParse(dateStr, out var parsedDate))
            {
                var fb = await renderer.RenderAsync<Feedback>(parms =>
                {
                    parms[nameof(Feedback.Type)] = "error";
                    parms[nameof(Feedback.Message)] = "Date is required.";
                });
                await sse.PatchElementsAsync(fb);
                return;
            }
            var cycle = await db.Cycles.FindAsync(1);
            if (cycle == null)
            {
                cycle = new Cycle { Id = 1 };
                db.Cycles.Add(cycle);
            }
            cycle.StartDate = parsedDate;
            cycle.Trap1Time = TimeOnly.Parse(form["trap1Time"].FirstOrDefault() ?? "00:00");
            cycle.Trap2Time = TimeOnly.Parse(form["trap2Time"].FirstOrDefault() ?? "00:00");
            await db.SaveChangesAsync();
            var fbOk = await renderer.RenderAsync<Feedback>(parms =>
            {
                parms[nameof(Feedback.Type)] = "success";
                parms[nameof(Feedback.Message)] = "Cycle updated!";
            });
            await sse.PatchElementsAsync(fbOk);
        });

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
