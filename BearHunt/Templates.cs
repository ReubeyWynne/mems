namespace BearHunt;
public static class Templates
{
    public static string E(string? s) => System.Net.WebUtility.HtmlEncode(s ?? "");
    public static string FmtK(int n) => n switch
    {
        < 1000 => n.ToString(),
        _ => (n / 1000f) % 1 == 0 ? $"{n / 1000}k" : $"{n / 1000f:F1}k"
    };
}
