using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/ciudades")]
public class CiudadesController : ControllerBase
{
    private readonly AppDbContext _context;

    public CiudadesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetCiudades()
    {
        var ciudades = await _context.Ciudades.ToListAsync();
        return Ok(ciudades);
    }
}