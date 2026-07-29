using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Exceptions;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Domain.Entities;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

public class ResultadoService : IResultadoService
{
    /// <summary>Tope duro de filas por página en el listado del panel.</summary>
    public const int TamanoPaginaMaximo = 500;

    /// <summary>Filas por página cuando el cliente no pide un tamaño.</summary>
    public const int TamanoPaginaPorDefecto = 200;

    private readonly AppDbContext _context;
    private readonly ILogger<ResultadoService> _logger;

    public ResultadoService(AppDbContext context, ILogger<ResultadoService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Guarda el informe completo del estudiante (usuario + test + respuestas +
    /// resultado). Todo va en una transacción: si algo falla no queda ni el
    /// usuario ni el test a medias.
    /// </summary>
    public async Task<ResultadoResponseDto> RegistrarResultadoAsync(ResultadoRequest request)
    {
        var registro = request.Registro;

        // Los catálogos se resuelven por nombre (case-insensitive). Si el nombre no
        // existe la FK queda en null: no se crean filas de catálogo desde el flujo público.
        var tipoDocumentoId = await BuscarTipoDocumentoIdAsync(registro.TipoDocumento);
        var ciudadId = await BuscarCiudadIdAsync(registro.Ciudad);
        var gradoId = await BuscarGradoIdAsync(registro.Grado);

        var perfilVocacionalId = await BuscarPerfilVocacionalIdAsync(request.Resultado);
        var programaAcademicoId = await BuscarProgramaAcademicoIdAsync(request.Resultado.Carrera);

        var (puntaje, porcentaje) = CalcularPuntaje(request.Resultado);

        await using var transaccion = await _context.Database.BeginTransactionAsync();

        try
        {
            var usuario = await ObtenerOCrearUsuarioAsync(registro, tipoDocumentoId, ciudadId, gradoId);
            await _context.SaveChangesAsync();

            var test = new Test
            {
                UsuarioId = usuario.Id,
                Fecha = DateTime.UtcNow,
                Estado = true
            };
            _context.Tests.Add(test);
            await _context.SaveChangesAsync();

            await AgregarRespuestasAsync(request.Respuestas, test.Id);

            var resultado = new Resultado
            {
                TestId = test.Id,
                Puntaje = puntaje,
                Porcentaje = porcentaje,
                PerfilVocacionalId = perfilVocacionalId,
                ProgramaAcademicoId = programaAcademicoId,
                Fecha = DateTime.UtcNow
            };
            _context.Resultados.Add(resultado);
            await _context.SaveChangesAsync();

            await transaccion.CommitAsync();

            return new ResultadoResponseDto
            {
                Id = resultado.Id.ToString(),
                Fecha = FormatearUtc(resultado.Fecha)
            };
        }
        catch (DbUpdateException ex)
        {
            // Choque de índice único (correo o tipo+número de documento) o
            // cualquier otro rechazo de la base: se traduce a un conflicto con
            // cuerpo contractual en vez de dejar salir un 500 con el SQL y la PII.
            await transaccion.RollbackAsync();
            _logger.LogWarning(ex,
                "POST /api/resultados: la base rechazó el guardado del informe.");
            throw new RegistroConflictoException(
                "No se pudo guardar el informe: los datos de identificación " +
                "(correo o documento) ya pertenecen a otro registro.", ex);
        }
        catch
        {
            await transaccion.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Listado paginado para el panel. `pagina` arranca en 1; `tamano` se recorta
    /// a <see cref="TamanoPaginaMaximo"/> para que el endpoint no pueda devolver
    /// la tabla entera de una vez.
    /// </summary>
    public async Task<List<ResultadoListItemDto>> ObtenerResultadosAsync(int pagina, int tamano)
    {
        if (pagina < 1) pagina = 1;
        if (tamano < 1) tamano = TamanoPaginaPorDefecto;
        if (tamano > TamanoPaginaMaximo) tamano = TamanoPaginaMaximo;

        // El orden se aplica sobre la Fecha (DateTime) ANTES de proyectar, para que
        // lo resuelva SQL. El formato ISO se arma después, en memoria: ToString("o")
        // no se traduce a SQL.
        var filas = await _context.Resultados
            .AsNoTracking()
            .OrderByDescending(r => r.Fecha)
            .ThenByDescending(r => r.Id)
            .Skip((pagina - 1) * tamano)
            .Take(tamano)
            .Select(r => new
            {
                r.Id,
                NombreEstudiante = r.Test != null && r.Test.Usuario != null
                    ? r.Test.Usuario.Nombre + " " + r.Test.Usuario.Apellido
                    : "Desconocido",
                CorreoEstudiante = r.Test != null && r.Test.Usuario != null
                    ? r.Test.Usuario.Correo
                    : string.Empty,
                r.Puntaje,
                r.Porcentaje,
                PerfilVocacional = r.PerfilVocacional != null ? r.PerfilVocacional.Nombre : null,
                ProgramaAcademico = r.ProgramaAcademico != null ? r.ProgramaAcademico.Nombre : null,
                r.Fecha
            })
            .ToListAsync();

        return filas.Select(f => new ResultadoListItemDto
        {
            Id = f.Id,
            NombreEstudiante = f.NombreEstudiante,
            CorreoEstudiante = f.CorreoEstudiante,
            Puntaje = f.Puntaje,
            Porcentaje = f.Porcentaje,
            PerfilVocacional = f.PerfilVocacional,
            ProgramaAcademico = f.ProgramaAcademico,
            Fecha = FormatearUtc(f.Fecha)
        }).ToList();
    }

    /// <summary>
    /// Busca al estudiante por correo (y, si no aparece, por documento, porque el
    /// índice único TipoDocumentoId + NumeroDocumento no admite duplicados).
    ///
    /// IMPORTANTE (endpoint público y anónimo): sobre un usuario que YA EXISTE no
    /// se toca ningún dato de identidad (Correo, NumeroDocumento,
    /// TipoDocumentoId) ni el interruptor de acceso (Estado, PasswordHash,
    /// RolId). Cualquiera podría mandar el correo o el documento de otra persona:
    /// escribir esos campos permitía suplantar, secuestrar el correo de login y
    /// reactivar cuentas deshabilitadas. Solo se completan los campos
    /// descriptivos que estén vacíos.
    /// </summary>
    private async Task<Usuario> ObtenerOCrearUsuarioAsync(
        RegistroDto registro, int? tipoDocumentoId, int? ciudadId, int? gradoId)
    {
        var correo = Limpiar(registro.Correo);
        var documento = Limpiar(registro.NumeroDocumento);

        // Sin documento no se puede usar el índice (TipoDocumentoId, NumeroDocumento):
        // si se dejara el tipo con el número vacío, dos registros sin documento
        // chocarían entre sí. Con el tipo en null MySQL los considera distintos.
        if (documento.Length == 0)
            tipoDocumentoId = null;

        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Correo == correo);

        if (usuario == null && documento.Length > 0)
        {
            usuario = await _context.Usuarios.FirstOrDefaultAsync(u =>
                u.TipoDocumentoId == tipoDocumentoId && u.NumeroDocumento == documento);
        }

        if (usuario != null)
        {
            // Cuenta con acceso (admin o cualquier usuario con contraseña/rol): el
            // flujo público no la modifica ni le cuelga informes.
            if (!string.IsNullOrWhiteSpace(usuario.PasswordHash) || usuario.RolId != null)
            {
                _logger.LogWarning(
                    "POST /api/resultados: se intentó registrar sobre la cuenta {UsuarioId}, " +
                    "que tiene acceso al sistema. Petición rechazada.", usuario.Id);

                throw new RegistroConflictoException(
                    "El correo o el documento indicados pertenecen a una cuenta del " +
                    "sistema. Usa datos propios para registrar el test.");
            }

            CompletarCamposVacios(usuario, registro, ciudadId, gradoId);
            return usuario;
        }

        usuario = new Usuario
        {
            Nombre = Limpiar(registro.Nombre),
            Apellido = Limpiar(registro.Apellidos),
            Correo = correo,
            // El registro del test NO es una cuenta: queda sin contraseña y
            // AuthService rechaza el login de los usuarios sin PasswordHash.
            PasswordHash = string.Empty,
            Telefono = Limpiar(registro.Celular),
            NumeroDocumento = documento,
            InstitucionEducativa = Limpiar(registro.Colegio),
            TipoDocumentoId = tipoDocumentoId,
            CiudadId = ciudadId,
            GradoId = gradoId,
            // Estado solo se fija al crear: nunca se reactiva una cuenta existente
            // desde el flujo público.
            Estado = true,
            FechaRegistro = DateTime.UtcNow
        };

        // La edad llega como texto ("17", "23 o más"): si no se puede parsear queda en 0.
        if (int.TryParse(registro.Edad, out var edadNueva) && edadNueva > 0)
            usuario.Edad = edadNueva;

        _context.Usuarios.Add(usuario);
        return usuario;
    }

    /// <summary>
    /// Completa los datos descriptivos que el usuario todavía no tiene. Nunca
    /// sobreescribe un valor cargado ni toca campos de identidad/acceso.
    /// </summary>
    private static void CompletarCamposVacios(
        Usuario usuario, RegistroDto registro, int? ciudadId, int? gradoId)
    {
        if (string.IsNullOrWhiteSpace(usuario.Nombre))
            usuario.Nombre = Limpiar(registro.Nombre);

        if (string.IsNullOrWhiteSpace(usuario.Apellido))
            usuario.Apellido = Limpiar(registro.Apellidos);

        if (string.IsNullOrWhiteSpace(usuario.Telefono))
            usuario.Telefono = Limpiar(registro.Celular);

        if (string.IsNullOrWhiteSpace(usuario.InstitucionEducativa))
            usuario.InstitucionEducativa = Limpiar(registro.Colegio);

        usuario.CiudadId ??= ciudadId;
        usuario.GradoId ??= gradoId;

        if (usuario.Edad <= 0 && int.TryParse(registro.Edad, out var edad) && edad > 0)
            usuario.Edad = edad;
    }

    /// <summary>
    /// Guarda las respuestas del quiz. Las preguntas y opciones viven en el
    /// frontend, así que si no existen en la base la respuesta se guarda con las
    /// FKs en null en vez de fallar.
    ///
    /// TODO: la "letra" que manda el frontend no se persiste porque Respuesta no
    /// tiene columna para ella (requiere migración); la opción elegida se
    /// identifica por su texto contra OpcionesRespuesta.
    /// </summary>
    private async Task AgregarRespuestasAsync(List<RespuestaItemDto> respuestas, int testId)
    {
        if (respuestas == null || respuestas.Count == 0)
            return;

        var preguntaIds = respuestas.Select(r => (int?)r.PreguntaId).Distinct().ToList();

        var preguntasExistentes = await _context.Preguntas
            .Where(p => preguntaIds.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync();

        var opciones = await _context.OpcionesRespuesta
            .Where(o => preguntaIds.Contains(o.PreguntaId))
            .Select(o => new { o.Id, o.PreguntaId, o.Texto })
            .ToListAsync();

        var preguntasSinResolver = 0;
        var opcionesSinResolver = 0;

        foreach (var r in respuestas)
        {
            int? preguntaId = preguntasExistentes.Contains(r.PreguntaId) ? r.PreguntaId : null;
            int? opcionRespuestaId = null;

            if (preguntaId == null) preguntasSinResolver++;

            var texto = Limpiar(r.Texto);
            if (preguntaId != null && texto.Length > 0)
            {
                opcionRespuestaId = opciones
                    .FirstOrDefault(o => o.PreguntaId == preguntaId
                        && string.Equals(o.Texto.Trim(), texto, StringComparison.OrdinalIgnoreCase))
                    ?.Id;
            }

            if (opcionRespuestaId == null) opcionesSinResolver++;

            _context.Respuestas.Add(new Respuesta
            {
                TestId = testId,
                PreguntaId = preguntaId,
                OpcionRespuestaId = opcionRespuestaId
            });
        }

        // La degradación a null ya no es silenciosa: si el catálogo de la base no
        // está alineado con el banco de preguntas del frontend (p. ej. el
        // AUTO_INCREMENT de Preguntas no arrancó en 1), las respuestas quedan
        // huérfanas y hay que enterarse.
        if (preguntasSinResolver > 0)
        {
            _logger.LogWarning(
                "Test {TestId}: {SinResolver} de {Total} respuestas no encontraron su Pregunta " +
                "(los ids del cliente no coinciden con los de la base) y se guardaron con " +
                "PreguntaId = NULL.", testId, preguntasSinResolver, respuestas.Count);
        }
        else if (opcionesSinResolver > 0)
        {
            _logger.LogWarning(
                "Test {TestId}: {SinResolver} de {Total} respuestas no encontraron su " +
                "OpcionRespuesta por texto y se guardaron con OpcionRespuestaId = NULL.",
                testId, opcionesSinResolver, respuestas.Count);
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>Puntaje = respuestas de la letra ganadora; porcentaje sobre el total.</summary>
    private (decimal Puntaje, decimal Porcentaje) CalcularPuntaje(ResultadoDatosDto datos)
    {
        // Comparador insensible a mayúsculas: la letra y las claves de `contadores`
        // llegan del cliente y no hay garantía de que usen la misma caja.
        var contadores = new Dictionary<string, int>(
            datos.Contadores ?? new Dictionary<string, int>(),
            StringComparer.OrdinalIgnoreCase);

        var total = contadores.Values.Sum();
        var letra = Limpiar(datos.Letra);

        if (!contadores.TryGetValue(letra, out var puntaje) && total > 0)
        {
            _logger.LogWarning(
                "POST /api/resultados: la letra ganadora '{Letra}' no aparece en `contadores`; " +
                "se guarda Puntaje = 0.", letra);
        }

        var porcentaje = total > 0
            ? Math.Round((decimal)puntaje / total * 100m, 2)
            : 0m;

        return (puntaje, porcentaje);
    }

    /// <summary>
    /// ISO 8601 en UTC, siempre con la 'Z'. Las columnas MySQL son `datetime(6)`
    /// (sin zona), así que al releerlas el proveedor devuelve Kind=Unspecified y
    /// ToString("o") saldría sin sufijo: el mismo campo tendría dos formatos según
    /// el endpoint y el navegador lo interpretaría como hora local.
    /// </summary>
    private static string FormatearUtc(DateTime fecha) =>
        DateTime.SpecifyKind(fecha, DateTimeKind.Utc).ToString("o");

    private async Task<int?> BuscarTipoDocumentoIdAsync(string nombre)
    {
        var buscado = Limpiar(nombre).ToLower();
        if (buscado.Length == 0) return null;

        return await _context.TiposDocumento
            .Where(t => t.Nombre.ToLower() == buscado)
            .Select(t => (int?)t.Id)
            .FirstOrDefaultAsync();
    }

    private async Task<int?> BuscarCiudadIdAsync(string nombre)
    {
        var buscado = Limpiar(nombre).ToLower();
        if (buscado.Length == 0) return null;

        return await _context.Ciudades
            .Where(c => c.Nombre.ToLower() == buscado)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();
    }

    private async Task<int?> BuscarGradoIdAsync(string nombre)
    {
        var buscado = Limpiar(nombre).ToLower();
        if (buscado.Length == 0) return null;

        return await _context.Grados
            .Where(g => g.Nombre.ToLower() == buscado)
            .Select(g => (int?)g.Id)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// El frontend manda en "perfil" el texto descriptivo del perfil, mientras que
    /// el catálogo se siembra con el nombre del área. Se intenta primero con el
    /// perfil y, si no coincide, con el área.
    /// </summary>
    private async Task<int?> BuscarPerfilVocacionalIdAsync(ResultadoDatosDto datos)
    {
        return await BuscarPerfilPorNombreAsync(datos.Perfil)
            ?? await BuscarPerfilPorNombreAsync(datos.Area);
    }

    private async Task<int?> BuscarPerfilPorNombreAsync(string nombre)
    {
        var buscado = Limpiar(nombre).ToLower();
        if (buscado.Length == 0) return null;

        return await _context.PerfilesVocacionales
            .Where(p => p.Nombre.ToLower() == buscado)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync();
    }

    private async Task<int?> BuscarProgramaAcademicoIdAsync(string carrera)
    {
        var buscado = Limpiar(carrera).ToLower();
        if (buscado.Length == 0) return null;

        return await _context.ProgramasAcademicos
            .Where(p => p.Nombre.ToLower() == buscado)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync();
    }

    /// <summary>Normaliza un texto del formulario: nunca devuelve null.</summary>
    private static string Limpiar(string? valor) => (valor ?? string.Empty).Trim();
}
