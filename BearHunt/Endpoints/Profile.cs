using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.EntityFrameworkCore;

namespace BearHunt.Endpoints;

public static class ProfileEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/profile/username", async (HttpRequest request, HttpResponse response, AppDbContext db) =>
        {
            var form = await request.ReadFormAsync();
            var newUsername = form["username"].FirstOrDefault()?.Trim() ?? "";

            if (string.IsNullOrEmpty(newUsername))
            {
                response.StatusCode = 400;
                return;
            }

            var oldUsername = AuthHelper.GetUsername(request);

            // If changing username, migrate data
            if (oldUsername != null && !string.Equals(oldUsername, newUsername, StringComparison.OrdinalIgnoreCase))
            {
                var oldMember = await db.Members.FindAsync(oldUsername);
                if (oldMember != null)
                {
                    var newMember = await db.Members.FindAsync(newUsername) ?? new Member { Username = newUsername };
                    if (newMember.UpdatedAt == default)
                    {
                        newMember.Infantry = oldMember.Infantry;
                        newMember.Cavalry = oldMember.Cavalry;
                        newMember.Archers = oldMember.Archers;
                        newMember.RallyLeadHero = oldMember.RallyLeadHero;
                        newMember.WidgetLevel = oldMember.WidgetLevel;
                        newMember.RallySize = oldMember.RallySize;
                        newMember.SoloMarchSize = oldMember.SoloMarchSize;
                        newMember.Role = oldMember.Role;
                        newMember.UpdatedAt = DateTime.UtcNow;
                        db.Members.Add(newMember);
                    }

                    // Migrate preferences
                    var prefs = await db.Preferences.Where(p => p.Username == oldUsername).ToListAsync();
                    foreach (var p in prefs)
                        p.Username = newUsername;

                    db.Members.Remove(oldMember);
                }
            }
            else if (oldUsername == null)
            {
                // First time: ensure a member row exists
                if (await db.Members.FindAsync(newUsername) == null)
                    db.Members.Add(new Member { Username = newUsername, UpdatedAt = DateTime.UtcNow });
            }

            await db.SaveChangesAsync();

            response.Cookies.Append("kh_username", newUsername, new CookieOptions
            {
                SameSite = SameSiteMode.Strict,
                Expires = DateTimeOffset.UtcNow.AddDays(365)
            });
            response.Redirect("/bear-hunt/profile");
        }).DisableAntiforgery();
    }
}
