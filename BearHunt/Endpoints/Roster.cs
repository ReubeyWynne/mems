using BearHunt.Data;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class RosterEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/roster", async (IDatastarService sse, AppDbContext db) =>
        {
            var members = await db.Members.OrderBy(m => m.Username).ToListAsync();
            var rows = string.Concat(members.Select(Templates.MemberRow));
            await sse.PatchElementsAsync($"""<tbody id="roster-rows">{rows}</tbody>""");
        });
    }
}
