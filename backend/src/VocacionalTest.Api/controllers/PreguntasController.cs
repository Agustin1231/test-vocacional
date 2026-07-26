using Microsoft.AspNetCore.Mvc;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/preguntas")]
public class PreguntasController : ControllerBase
{
    private readonly IPreguntaService _preguntaService;

    public PreguntasController(IPreguntaService preguntaService)
    {
        _preguntaService = preguntaService;
    }

    [HttpGet]
    public async Task<IActionResult> GetPreguntas()
    {
        var preguntas = await _preguntaService.ObtenerPreguntasActivasAsync();
        return Ok(preguntas);
    }
}