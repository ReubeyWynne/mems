using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;

namespace BearHunt.Services;

/// <summary>
/// Scoped service that properly creates HtmlRenderer from the request's
/// IServiceProvider, ensuring correct Dispatcher affinity.
/// </summary>
public sealed class RazorRenderer
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public RazorRenderer(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<string> RenderAsync<T>(Action<Dictionary<string, object?>> configureParams)
        where T : IComponent
    {
        var ctx = _httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No HttpContext available");
        var sp = ctx.RequestServices;

        var renderer = new HtmlRenderer(sp, sp.GetRequiredService<ILoggerFactory>());

        var parms = new Dictionary<string, object?>();
        configureParams(parms);

        var result = await renderer.Dispatcher.InvokeAsync(async () =>
        {
            var html = await renderer.RenderComponentAsync<T>(ParameterView.FromDictionary(parms));
            return html.ToHtmlString();
        });

        return result;
    }
}
