using Microsoft.EntityFrameworkCore;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

public class CiudadService : ICiudadService
{
    private readonly AppDbContext _context;

    public CiudadService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<CiudadDto>> ObtenerCiudadesAsync()
    {
        return await _context.Ciudades
            .AsNoTracking()
            .Select(c => new CiudadDto
            {
                Id = c.Id,
                Nombre = c.Nombre
            })
            .ToListAsync();
    }
}