using StarFederation.Datastar;
using BearHunt.Data;
using BearHunt.Models;
using BearHunt.Helpers;
using BearHunt.Components.Fragments;
using BearHunt.Services;

namespace BearHunt.Endpoints;

public static class MembersEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/members/upsert", async (IDatastarService sse, HttpRequest request, AppDbContext db,
            RazorRenderer renderer) =>
        {
            var username = AuthHelper.GetUsername(request);

            if (string.IsNullOrEmpty(username))
            {
                var fb = await renderer.RenderAsync<Feedback>(parms =>
                {
                    parms[nameof(Feedback.Type)] = "error";
                    parms[nameof(Feedback.Message)] = "Set a username first.";
                });
                await sse.PatchElementsAsync(fb);
                return;
            }

            var form = await request.ReadFormAsync();
            var member = await db.Members.FindAsync(username);
            if (member == null)
            {
                member = new Member { Username = username };
                db.Members.Add(member);
            }

            member.Infantry = Parsing.ParseInt(form["infantry"]);
            member.Cavalry = Parsing.ParseInt(form["cavalry"]);
            member.Archers = Parsing.ParseInt(form["archers"]);
            member.RallyLeadHero = form["rallyLeadHero"].FirstOrDefault() ?? "";
            member.WidgetLevel = Math.Clamp(Parsing.ParseInt(form["widgetLevel"], 3), 1, 5);
            member.RallySize = Parsing.ParseInt(form["rallySize"]);
            member.SoloMarchSize = Parsing.ParseInt(form["soloMarchSize"]);
            member.RallyJoinerCap = Parsing.ParseInt(form["rallyJoinerCap"]);
            member.PreferredBearWindow = form["preferredBearWindow"].FirstOrDefault() ?? "";
            member.InfantryAtkPct = Parsing.ParseNullableInt(form["infantryAtkPct"]);
            member.InfantryLethalityPct = Parsing.ParseNullableInt(form["infantryLethalityPct"]);
            member.CavalryAtkPct = Parsing.ParseNullableInt(form["cavalryAtkPct"]);
            member.CavalryLethalityPct = Parsing.ParseNullableInt(form["cavalryLethalityPct"]);
            member.ArcherAtkPct = Parsing.ParseNullableInt(form["archerAtkPct"]);
            member.ArcherLethalityPct = Parsing.ParseNullableInt(form["archerLethalityPct"]);
            member.MarchCount = Parsing.ParseInt(form["marchCount"]);
            member.TroopTier = Parsing.ParseInt(form["troopTier"]);
            member.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync();
            var ok = await renderer.RenderAsync<Feedback>(parms =>
            {
                parms[nameof(Feedback.Type)] = "success";
                parms[nameof(Feedback.Message)] = "Profile saved!";
            });
            await sse.PatchElementsAsync(ok);
        }).DisableAntiforgery();
    }
}
