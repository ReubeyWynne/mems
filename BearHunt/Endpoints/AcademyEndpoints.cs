using BearHunt.Components.Fragments;
using BearHunt.Data;
using BearHunt.Models;
using BearHunt.Services;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class AcademyEndpoints
{
    public static void Map(WebApplication app)
    {
        // Formation compute: triggered from the Academy page's form via
        // data-on:submit="@get('/api/academy/formation')". Datastar sends the
        // bound signals as query params; we return the output section as an
        // SSE fragment so the page updates without a reload. The fragment
        // comes from the shared FormationOutput component (same render the
        // SSR page uses) so the two can never drift apart.
        app.MapGet("/api/academy/formation", async (
            IDatastarService sse, AppDbContext db, HttpRequest request, RazorRenderer renderer) =>
        {
            var username = request.Cookies.TryGetValue("kh_username", out var u) ? u : "";
            Member? viewer = !string.IsNullOrEmpty(username) ? await db.Members.FindAsync(username) : null;
            var members = await db.Members.ToListAsync();

            var result = AcademyFormation.Compute(AcademyFormation.Parse(request.Query, viewer), members);
            var html = await renderer.RenderAsync<FormationOutput>(
                parms => parms[nameof(FormationOutput.Result)] = result);
            await sse.PatchElementsAsync(html);
        });

        // Timeline compute: Datastar endpoint for the interactive timeline
        // controls (data-on:change triggers); bound signals arrive as query
        // params and we return the #timeline fragment as an SSE patch. The
        // fragment comes from the shared AcademyTimelineView component (same
        // render the SSR page uses) so the two can never drift apart.
        app.MapGet("/api/academy/timeline", async (
            IDatastarService sse, AppDbContext db, HttpRequest request, RazorRenderer renderer) =>
        {
            var cycle = await db.Cycles.FindAsync(1);
            var members = await db.Members.ToListAsync();
            var prefs = await db.Preferences.ToListAsync();
            var plan = AcademyTimeline.Compute(AcademyTimeline.Parse(request.Query, cycle, members, prefs));
            var html = await renderer.RenderAsync<AcademyTimelineView>(
                parms => parms[nameof(AcademyTimelineView.Plan)] = plan);
            await sse.PatchElementsAsync(html);
        });
    }
}
