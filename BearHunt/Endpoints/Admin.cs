using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;
using StarFederation.Datastar.DependencyInjection;

namespace BearHunt.Endpoints;

public static class AdminEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/admin/assign-wave", async (IDatastarService sse, AppDbContext db,
            HttpRequest request, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection)) return;
            var signals = await sse.ReadSignalsAsync<WaveAssignSignals>();
            if (signals is null) return;

            var pref = await db.Preferences.FindAsync(signals.prefId);
            if (pref is null) return;

            pref.Wave = string.IsNullOrEmpty(signals.wave) ? null : signals.wave;
            await Templates.ReRenderTrapRoster(sse, db, pref.SelectedTrap, true);

        });

        app.MapPost("/api/admin/toggle-rally-lead", async (IDatastarService sse, AppDbContext db,
            HttpRequest request, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection)) return;
            var signals = await sse.ReadSignalsAsync<RallyLeadToggleSignals>();
            if (signals is null) return;

            var pref = await db.Preferences.FindAsync(signals.prefId);
            if (pref is null) return;

            pref.IsRallyLead = !pref.IsRallyLead;
            await db.SaveChangesAsync();

            await Templates.ReRenderTrapRoster(sse, db, pref.SelectedTrap, true);
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
    }
}
