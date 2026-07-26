using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocacionalTest.Api.DTOs;
using VocacionalTest.Domain.Entities;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/resultados")]
public class ResultadosController : ControllerBase
{
    private readonly AppDbContext _context;

    public ResultadosController(AppDbContext context)
    {
        _context = context; 
    }

    [HttpPost]
    public async Task<IActionResult> PostResultado([FromBody] ResultadoRequest request)
    {
        // 1. Buscar si el usuario ya existe (por correo), si no, crearlo
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

        // 2. Crear el Test
        var test = new Test
        {
            UsuarioId = usuario.Id,
            Fecha = DateTime.UtcNow,
            Estado = true
        };
        _context.Tests.Add(test);
        await _context.SaveChangesAsync();

        // 3. Crear las respuestas
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

        // 4. Crear el resultado
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

        // 5. Responder según el contrato
        return Ok(new
        {
            id = resultado.Id.ToString(),
            fecha = resultado.Fecha.ToString("o")
        });
    }
}