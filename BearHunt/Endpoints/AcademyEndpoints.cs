using BearHunt.Data;
using BearHunt.Models;
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
        // SSE fragment so the page updates without a reload.
        app.MapGet("/api/academy/formation", async (
            IDatastarService sse, AppDbContext db, HttpRequest request) =>
        {
            var username = request.Cookies.TryGetValue("kh_username", out var u) ? u : "";
            Member? viewer = !string.IsNullOrEmpty(username) ? await db.Members.FindAsync(username) : null;
            var members = await db.Members.ToListAsync();

            var result = AcademyFormation.Compute(AcademyFormation.Parse(request.Query, viewer), members);
            await sse.PatchElementsAsync($"""<div id="formation-output">{AcademyFormation.RenderHtml(result)}</div>""");
        });
    }
}
