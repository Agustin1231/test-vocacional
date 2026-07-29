using System.ComponentModel.DataAnnotations;

namespace VocacionalTest.Application.DTOs;

/// <summary>
/// Cuerpo de POST /api/resultados. El frontend manda nombres (no ids): el
/// backend resuelve los ids de los catálogos contra la base de datos.
/// </summary>
public class ResultadoRequest
{
    [Required]
    public RegistroDto Registro { get; set; } = new();

    [Required]
    public List<RespuestaItemDto> Respuestas { get; set; } = new();

    [Required]
    public ResultadoDatosDto Resultado { get; set; } = new();
}

public class RegistroDto
{
    [Required, StringLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Apellidos { get; set; } = string.Empty;

    /// <summary>Nombre del tipo de documento, no el id (ej. "Cédula de Ciudadanía (CC)").</summary>
    [StringLength(80)]
    public string TipoDocumento { get; set; } = string.Empty;

    [Required, StringLength(30)]
    public string NumeroDocumento { get; set; } = string.Empty;

    [StringLength(30)]
    public string Celular { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string Correo { get; set; } = string.Empty;

    [StringLength(150)]
    public string Colegio { get; set; } = string.Empty;

    /// <summary>Nombre del grado (ej. "Once").</summary>
    [StringLength(80)]
    public string Grado { get; set; } = string.Empty;

    /// <summary>Nombre de la ciudad (ej. "Bogotá D.C.").</summary>
    [StringLength(80)]
    public string Ciudad { get; set; } = string.Empty;

    /// <summary>Llega como texto ("17", "23 o más"); el backend la parsea a int.</summary>
    [StringLength(20)]
    public string Edad { get; set; } = string.Empty;
}

public class RespuestaItemDto
{
    public int PreguntaId { get; set; }

    [StringLength(5)]
    public string Letra { get; set; } = string.Empty;

    /// <summary>Texto de la opción elegida; con él se resuelve la OpcionRespuesta.</summary>
    [StringLength(500)]
    public string Texto { get; set; } = string.Empty;
}

public class ResultadoDatosDto
{
    [Required, StringLength(5)]
    public string Letra { get; set; } = string.Empty;

    /// <summary>Perfil vocacional ganador (se resuelve contra PerfilesVocacionales).</summary>
    [StringLength(1000)]
    public string Perfil { get; set; } = string.Empty;

    /// <summary>Programa académico recomendado (se resuelve contra ProgramasAcademicos).</summary>
    [StringLength(150)]
    public string Carrera { get; set; } = string.Empty;

    [StringLength(150)]
    public string Area { get; set; } = string.Empty;

    /// <summary>Conteo de respuestas por letra: { "A": 5, "B": 2, ... }.</summary>
    public Dictionary<string, int> Contadores { get; set; } = new();
}
