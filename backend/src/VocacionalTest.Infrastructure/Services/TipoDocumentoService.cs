using Microsoft.EntityFrameworkCore;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

public class TipoDocumentoService : ITipoDocumentoService
{
    private readonly AppDbContext _context;

    public TipoDocumentoService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<TipoDocumentoDto>> ObtenerTiposDocumentoAsync()
    {
        return await _context.TiposDocumento
            .AsNoTracking()
            .Select(t => new TipoDocumentoDto
            {
                Id = t.Id,
                Nombre = t.Nombre
            })
            .ToListAsync();
    }
}