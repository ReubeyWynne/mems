using BearHunt.Data;
using BearHunt.Components.Fragments;
using BearHunt.Helpers;
using BearHunt.Models;
using BearHunt.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using StarFederation.Datastar;

namespace BearHunt.Endpoints;

public static class JokesEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/jokes", async (AppDbContext db, HttpRequest request,
            IDataProtectionProvider protection, RazorRenderer renderer) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection))
                return Results.Unauthorized();
            var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
            var html = await renderer.RenderAsync<JokeList>(parms =>
            {
                parms[nameof(JokeList.Jokes)] = jokes;
            });
            return Results.Content(html, "text/html");
        });

        app.MapPost("/api/jokes", async (IDatastarService sse, AppDbContext db, HttpRequest request,
            IDataProtectionProvider protection, RazorRenderer renderer) =>
        {
            if (!AuthHelper.IsAdminAuthenticated(request, protection))
            {
                var fb = await renderer.RenderAsync<Feedback>(parms =>
                {
                    parms[nameof(Feedback.Type)] = "error";
                    parms[nameof(Feedback.Message)] = "Unauthorized.";
                });
                await sse.PatchElementsAsync(fb);
                return;
            }
            var form = await request.ReadFormAsync();
            var text = form["text"].FirstOrDefault()?.Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                var fb = await renderer.RenderAsync<Feedback>(parms =>
                {
                    parms[nameof(Feedback.Type)] = "error";
                    parms[nameof(Feedback.Message)] = "Text is required.";
                });
                await sse.PatchElementsAsync(fb);
                return;
            }
            db.Jokes.Add(new Joke { Text = text, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            var jokes = await db.Jokes.OrderByDescending(j => j.Id).ToListAsync();
            var jl = await renderer.RenderAsync<JokeList>(parms =>
            {
                parms[nameof(JokeList.Jokes)] = jokes;
            });
            await sse.PatchElementsAsync($"""<div id="joke-list">{jl}</div>""");
        });

        app.MapDelete("/api/jokes/{id:int}", async (int id, IDatastarService sse, AppDbContext db,
            HttpRequest request, IDataProtectionProvider protection, RazorRenderer renderer) =>
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
            var jl = await renderer.RenderAsync<JokeList>(parms =>
            {
                parms[nameof(JokeList.Jokes)] = jokes;
            });
            await sse.PatchElementsAsync($"""<div id="joke-list">{jl}</div>""");
        });
    }
}
