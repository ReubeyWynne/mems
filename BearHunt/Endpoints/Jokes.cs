using BearHunt.Data;
using BearHunt.Helpers;
using BearHunt.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class JokesEndpoints
{
    public static void Map(WebApplication app)
    {

        app.MapGet("/api/jokes", async (AppDbContext db, HttpRequest request, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection))
                return Results.Unauthorized();
            var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
            return Results.Content(Templates.JokeList(jokes), "text/html");
        });

        app.MapPost("/api/jokes", async (IDatastarService sse, AppDbContext db, HttpRequest request, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection))
            {
                await sse.PatchElementsAsync(Templates.Feedback("error", "Unauthorized."));
                return;
            }
            var signals = await sse.ReadSignalsAsync<JokeSignals>();
            var text = signals?.text?.Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                await sse.PatchElementsAsync(Templates.Feedback("error", "Text is required."));
                return;
            }
            db.Jokes.Add(new Joke { Text = text, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
            await sse.PatchElementsAsync($"""<div id="joke-list">{Templates.JokeList(jokes)}</div>""");
        });

        app.MapDelete("/api/jokes/{id:int}", async (int id, IDatastarService sse, AppDbContext db, HttpRequest request, IDataProtectionProvider protection) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection))
                return;
            var joke = await db.Jokes.FindAsync(id);
            if (joke is not null)
            {
                db.Jokes.Remove(joke);
                await db.SaveChangesAsync();
            }
            var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
            await sse.PatchElementsAsync($"""<div id="joke-list">{Templates.JokeList(jokes)}</div>""");
        });
    }
}
