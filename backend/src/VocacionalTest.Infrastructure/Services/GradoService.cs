using Microsoft.EntityFrameworkCore;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

public class GradoService : IGradoService
{
    private readonly AppDbContext _context;

    public GradoService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<GradoDto>> ObtenerGradosAsync()
    {
        return await _context.Grados
            .Select(g => new GradoDto
            {
                Id = g.Id,
                Nombre = g.Nombre
            })
            .ToListAsync();
    }
}