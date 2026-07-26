global using StarFederation.Datastar.DependencyInjection;
using BearHunt.Data;
using BearHunt.Endpoints;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents();
builder.Services.AddDatastar();
builder.Services.AddScoped<BearHunt.Services.RazorRenderer>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/data/keys"));
builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlite("Data Source=/data/bearhunt.db"));

// Ensure /data exists for SQLite and Data Protection keys (Fly.io persistent volume)
Directory.CreateDirectory("/data");

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // Migration: add columns if missing
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Preferences ADD COLUMN Wave TEXT NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Preferences ADD COLUMN IsRallyLead INTEGER NOT NULL DEFAULT 0"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN PreferredBearWindow TEXT NOT NULL DEFAULT ''"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN InfantryAtkPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN InfantryLethalityPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN CavalryAtkPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN CavalryLethalityPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN ArcherAtkPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN ArcherLethalityPct INTEGER NULL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN MarchCount INTEGER NOT NULL DEFAULT 0"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Members ADD COLUMN RallyJoinerCap INTEGER NOT NULL DEFAULT 0"); } catch { }
    try { db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS Jokes (Id INTEGER PRIMARY KEY AUTOINCREMENT, Text TEXT NOT NULL, CreatedAt TEXT NOT NULL)"); } catch { }
}

app.UseAntiforgery();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapRazorComponents<BearHunt.Components.App>();

// ─── API Endpoints ────────────────────────────────────────────

MembersEndpoints.Map(app);
RosterEndpoints.Map(app);
ScheduleEndpoints.Map(app);
PreferencesEndpoints.Map(app);
CyclesEndpoints.Map(app);
AdminEndpoints.Map(app);
AllocatorEndpoints.Map(app);
AuthEndpoints.Map(app);
ProfileEndpoints.Map(app);
JokesEndpoints.Map(app);

app.Run();
