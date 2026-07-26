using Microsoft.Extensions.Primitives;

namespace BearHunt.Helpers;

public static class Parsing
{
    public static int ParseInt(StringValues v, int fallback = 0) =>
        int.TryParse(v.FirstOrDefault(), out var n) ? Math.Max(0, n) : fallback;

    public static int? ParseNullableInt(StringValues v) =>
        int.TryParse(v.FirstOrDefault(), out var n) && n > 0 ? n : null;
}
