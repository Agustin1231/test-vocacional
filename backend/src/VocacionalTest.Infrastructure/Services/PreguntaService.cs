using Microsoft.EntityFrameworkCore;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

public class PreguntaService : IPreguntaService
{
    private readonly AppDbContext _context;

    public PreguntaService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PreguntaDto>> ObtenerPreguntasActivasAsync()
    {
        return await _context.Preguntas
            .Include(p => p.Opciones)
            .Where(p => p.Estado)
            .Select(p => new PreguntaDto
            {
                Id = p.Id,
                Enunciado = p.Enunciado,
                Categoria = p.Categoria,
                Opciones = p.Opciones.Select(o => new OpcionDto
                {
                    Id = o.Id,
                    Texto = o.Texto
                }).ToList()
            })
            .ToListAsync();
    }
}