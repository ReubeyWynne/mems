using Microsoft.AspNetCore.DataProtection;

namespace BearHunt.Helpers;

public static class AuthHelper
{
    public static bool IsAdminAuthenticated(HttpRequest request, IDataProtectionProvider protection)
    {
        if (!request.Cookies.TryGetValue("bh_admin", out var cookie))
            return false;
        try
        {
            var protector = protection.CreateProtector("bh-admin-auth")
                .ToTimeLimitedDataProtector();
            protector.Unprotect(cookie);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static string? GetUsername(HttpRequest request) =>
        request.Cookies.TryGetValue("kh_username", out var u) ? u : null;
}
