using BearHunt.Data;
using BearHunt.Components.Fragments;
using BearHunt.Helpers;
using BearHunt.Models;
using BearHunt.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class AdminEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/admin/assign-wave/{prefId:int}", async (int prefId, IDatastarService sse, AppDbContext db,
            HttpRequest request, IDataProtectionProvider protection, RazorRenderer renderer) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection)) return;
            var form = await request.ReadFormAsync();
            var wave = form["wave"].FirstOrDefault();

            var pref = await db.Preferences.FindAsync(prefId);
            if (pref is null) return;

            pref.Wave = string.IsNullOrEmpty(wave) ? null : wave;
            await db.SaveChangesAsync();

            await ReRenderTrapRoster(sse, db, renderer, pref.SelectedTrap, true);
        }).DisableAntiforgery();

        app.MapPost("/api/admin/toggle-rally-lead/{prefId:int}", async (int prefId, IDatastarService sse, AppDbContext db,
            HttpRequest request, IDataProtectionProvider protection, RazorRenderer renderer) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection)) return;

            var pref = await db.Preferences.FindAsync(prefId);
            if (pref is null) return;

            pref.IsRallyLead = !pref.IsRallyLead;
            await db.SaveChangesAsync();

            await ReRenderTrapRoster(sse, db, renderer, pref.SelectedTrap, true);
        }).DisableAntiforgery();

        // Export database backup
        app.MapGet("/api/admin/export-db", (HttpRequest request, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection))
                return Results.Unauthorized();

            var path = "/data/bearhunt.db";
            if (!File.Exists(path))
                return Results.NotFound("Database file not found.");

            var bytes = File.ReadAllBytes(path);
            return Results.File(bytes, "application/octet-stream", $"bearhunt-{DateTime.UtcNow:yyyyMMdd-HHmmss}.db");
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

    static async Task ReRenderTrapRoster(IDatastarService sse, AppDbContext db,
        RazorRenderer renderer, string trap, bool isAdmin)
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
