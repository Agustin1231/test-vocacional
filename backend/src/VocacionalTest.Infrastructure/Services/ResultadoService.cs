using Microsoft.EntityFrameworkCore;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Domain.Entities;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

public class ResultadoService : IResultadoService
{
    private readonly AppDbContext _context;

    public ResultadoService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ResultadoResponseDto> RegistrarResultadoAsync(ResultadoRequest request)
    {
        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Correo == request.Registro.Correo);

        if (usuario == null)
        {
            usuario = new Usuario
            {
                Nombre = request.Registro.Nombre,
                Apellido = request.Registro.Apellido,
                Correo = request.Registro.Correo,
                Telefono = request.Registro.Telefono,
                Edad = request.Registro.Edad,
                NumeroDocumento = request.Registro.NumeroDocumento,
                TipoDocumentoId = request.Registro.TipoDocumentoId,
                CiudadId = request.Registro.CiudadId,
                GradoId = request.Registro.GradoId,
                InstitucionEducativa = request.Registro.InstitucionEducativa,
                PasswordHash = "",
                FechaRegistro = DateTime.UtcNow,
                Estado = true
            };
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();
        }

        var test = new Test
        {
            UsuarioId = usuario.Id,
            Fecha = DateTime.UtcNow,
            Estado = true
        };
        _context.Tests.Add(test);
        await _context.SaveChangesAsync();

        foreach (var r in request.Respuestas)
        {
            var respuesta = new Respuesta
            {
                TestId = test.Id,
                PreguntaId = r.PreguntaId,
                OpcionRespuestaId = r.OpcionRespuestaId
            };
            _context.Respuestas.Add(respuesta);
        }
        await _context.SaveChangesAsync();

        var resultado = new Resultado
        {
            TestId = test.Id,
            Puntaje = request.Resultado.Puntaje,
            Porcentaje = request.Resultado.Porcentaje,
            PerfilVocacionalId = request.Resultado.PerfilVocacionalId,
            ProgramaAcademicoId = request.Resultado.ProgramaAcademicoId,
            Fecha = DateTime.UtcNow
        };
        _context.Resultados.Add(resultado);
        await _context.SaveChangesAsync();

        return new ResultadoResponseDto
        {
            Id = resultado.Id.ToString(),
            Fecha = resultado.Fecha.ToString("o")
        };
    }
}