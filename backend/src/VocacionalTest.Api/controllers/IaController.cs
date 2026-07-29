using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/ia")]
public class IaController : ControllerBase
{
    private readonly IIaService _iaService;

    public IaController(IIaService iaService)
    {
        _iaService = iaService;
    }

    /// <summary>
    /// Chat con el asesor IA. Es público, igual que el resto del flujo del
    /// estudiante: el backend hace de proxy y agrega la API key del servicio.
    /// </summary>
    [HttpPost("chat")]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> Chat([FromBody] IaChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Texto) || string.IsNullOrWhiteSpace(request.SesionId))
            return BadRequest(new { mensaje = "Se requieren los campos texto y sesionId." });

        // La IP real del estudiante (ya resuelta por UseForwardedHeaders) viaja
        // hacia el servicio de IA para que su rate limit sea por estudiante.
        request.IpCliente = HttpContext.Connection.RemoteIpAddress?.ToString();

        var resultado = await _iaService.EnviarMensajeAsync(request);

        if (!resultado.Exitoso)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                mensaje = "El asesor IA no está disponible en este momento. " +
                          "Intenta de nuevo en unos minutos."
            });

        return Ok(new IaChatResponse { Reply = resultado.Reply });
    }
}
