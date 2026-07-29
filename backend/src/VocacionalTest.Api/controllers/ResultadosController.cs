using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Exceptions;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/resultados")]
public class ResultadosController : ControllerBase
{
    private readonly IResultadoService _resultadoService;

    public ResultadosController(IResultadoService resultadoService)
    {
        _resultadoService = resultadoService;
    }

    // Público: el estudiante no está logueado. Limitado por IP porque es el
    // endpoint abierto que escribe en la base.
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> PostResultado([FromBody] ResultadoRequest request)
    {
        try
        {
            var response = await _resultadoService.RegistrarResultadoAsync(request);
            return Ok(response);
        }
        catch (RegistroConflictoException ex)
        {
            // 409 con el cuerpo del contrato: el cliente puede distinguir "no se
            // guardó" de "no hubo conexión". El detalle técnico queda en el log.
            return Conflict(new { mensaje = ex.Message });
        }
    }

    // Solo el panel del equipo: devuelve nombre y correo de todos los
    // estudiantes, así que exige el rol de administrador y no solo un token
    // válido cualquiera.
    [HttpGet]
    [Authorize(Roles = "Administrador")]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> GetResultados(
        [FromQuery] int pagina = 1, [FromQuery] int tamano = 200)
    {
        var resultados = await _resultadoService.ObtenerResultadosAsync(pagina, tamano);
        return Ok(resultados);
    }
}
