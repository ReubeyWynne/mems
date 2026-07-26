using Microsoft.AspNetCore.DataProtection;

namespace BearHunt.Endpoints;

public static class AuthEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/admin/login", (HttpRequest request, HttpResponse response,
            IConfiguration config, IDataProtectionProvider protection) =>
        {
            var password = request.Form["password"].FirstOrDefault();
            var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? config["AdminPassword"];
            if (password == adminPassword)
            {
                var protector = protection.CreateProtector("bh-admin-auth")
                    .ToTimeLimitedDataProtector();
                var token = protector.Protect("authenticated", TimeSpan.FromHours(8));
                response.Cookies.Append("bh_admin", token, new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddHours(8)
                });
            }
            else
            {
                response.Redirect("/bear-hunt/admin?error=Wrong%20password");
                return Task.CompletedTask;
            }
            response.Redirect("/bear-hunt/admin");
            return Task.CompletedTask;
        }).DisableAntiforgery();

        app.MapPost("/api/admin/logout", (HttpResponse response) =>
        {
            response.Cookies.Delete("bh_admin");
            response.Redirect("/bear-hunt/admin");
            return Task.CompletedTask;
        }).DisableAntiforgery();
    }
}
