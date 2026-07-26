using Microsoft.AspNetCore.Mvc;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/grados")]
public class GradosController : ControllerBase
{
    private readonly IGradoService _gradoService;

    public GradosController(IGradoService gradoService)
    {
        _gradoService = gradoService;
    }

    [HttpGet]
    public async Task<IActionResult> GetGrados()
    {
        var grados = await _gradoService.ObtenerGradosAsync();
        return Ok(grados);
    }
}