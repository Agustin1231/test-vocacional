using Microsoft.AspNetCore.Mvc;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/tipos-documento")]
public class TiposDocumentoController : ControllerBase
{
    private readonly ITipoDocumentoService _tipoDocumentoService;

    public TiposDocumentoController(ITipoDocumentoService tipoDocumentoService)
    {
        _tipoDocumentoService = tipoDocumentoService;
    }

    [HttpGet]
    public async Task<IActionResult> GetTiposDocumento()
    {
        var tiposDocumento = await _tipoDocumentoService.ObtenerTiposDocumentoAsync();
        return Ok(tiposDocumento);
    }
}