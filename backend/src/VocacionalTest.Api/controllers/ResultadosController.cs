using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VocacionalTest.Application.DTOs;
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

    [HttpPost]
    public async Task<IActionResult> PostResultado([FromBody] ResultadoRequest request)
    {
        var response = await _resultadoService.RegistrarResultadoAsync(request);
        return Ok(response);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetResultados()
    {
        var resultados = await _resultadoService.ObtenerResultadosAsync();
        return Ok(resultados);
    }
}