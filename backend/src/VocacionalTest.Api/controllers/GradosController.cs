using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/grados")]
public class GradosController : ControllerBase
{
    private readonly AppDbContext _context;

    public GradosController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetGrados()
    {
        var grados = await _context.Grados.ToListAsync();
        return Ok(grados);
    }
}