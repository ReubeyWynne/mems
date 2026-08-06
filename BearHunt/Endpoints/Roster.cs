using BearHunt.Data;
using BearHunt.Components.Fragments;
using BearHunt.Services;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class RosterEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/roster", async (IDatastarService sse, AppDbContext db, RazorRenderer renderer) =>
        {
            var members = await db.Members.OrderBy(m => m.Username).ToListAsync();
            var html = await renderer.RenderAsync<MemberRows>(parms =>
            {
                parms[nameof(MemberRows.Members)] = members;
            });
            await sse.PatchElementsAsync(html);
        });
    }
}
