using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/preguntas")]
public class PreguntasController : ControllerBase
{
    private readonly AppDbContext _context;

    public PreguntasController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetPreguntas()
    {
        var preguntas = await _context.Preguntas
            .Include(p => p.Opciones)
            .Where(p => p.Estado)
            .ToListAsync();

        return Ok(preguntas);
    }
}