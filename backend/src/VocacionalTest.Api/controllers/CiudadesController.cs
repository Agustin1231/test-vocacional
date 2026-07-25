using Microsoft.AspNetCore.Mvc;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/ciudades")]
public class CiudadesController : ControllerBase
{
    private readonly ICiudadService _ciudadService;

    public CiudadesController(ICiudadService ciudadService)
    {
        _ciudadService = ciudadService;
    }

    [HttpGet]
    public async Task<IActionResult> GetCiudades()
    {
        var ciudades = await _ciudadService.ObtenerCiudadesAsync();
        return Ok(ciudades);
    }
}