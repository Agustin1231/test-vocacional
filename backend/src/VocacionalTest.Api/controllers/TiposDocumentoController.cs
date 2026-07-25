using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/tipos-documento")]
public class TiposDocumentoController : ControllerBase
{
    private readonly AppDbContext _context;

    public TiposDocumentoController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetTiposDocumento()
    {
        var tiposDocumento = await _context.TiposDocumento.ToListAsync();
        return Ok(tiposDocumento);
    }
}