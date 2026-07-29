using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace VocacionalTest.Application.DTOs;

/// <summary>
/// Lo que manda el navegador a POST /api/ia/chat. No lleva API key:
/// la clave del servicio de IA la agrega el backend.
/// </summary>
public class IaChatRequest
{
    [Required, StringLength(2000)]
    public string Texto { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string SesionId { get; set; } = string.Empty;

    /// <summary>
    /// Contexto del estudiante (opcional). Si no llega, el asesor responde en
    /// modo genérico: es preferible a inventar un nombre y una carrera.
    /// </summary>
    public IaChatContextoDto? Contexto { get; set; }

    /// <summary>
    /// IP real del estudiante, que el controller toma de HttpContext para que el
    /// servicio de IA pueda aplicar su rate limit por estudiante y no por
    /// backend. [JsonIgnore]: no se deserializa del cuerpo, así que el cliente no
    /// puede falsearla.
    /// </summary>
    [JsonIgnore]
    public string? IpCliente { get; set; }
}

/// <summary>
/// Datos del informe con los que se personaliza el asesor. El frontend los toma
/// del resultado que acaba de calcular; el backend no los recalcula.
/// </summary>
public class IaChatContextoDto
{
    [StringLength(120)]
    public string? Nombre { get; set; }

    [StringLength(1000)]
    public string? Perfil { get; set; }

    [StringLength(150)]
    public string? Area { get; set; }

    [StringLength(150)]
    public string? Carrera { get; set; }

    /// <summary>true si al menos un campo trae algo aprovechable.</summary>
    public bool TieneDatos() =>
        !string.IsNullOrWhiteSpace(Nombre)
        || !string.IsNullOrWhiteSpace(Perfil)
        || !string.IsNullOrWhiteSpace(Area)
        || !string.IsNullOrWhiteSpace(Carrera);
}

/// <summary>Respuesta del chat, tal como la espera el frontend: { "reply": "..." }.</summary>
public class IaChatResponse
{
    public string Reply { get; set; } = string.Empty;
}

/// <summary>
/// Cuerpo que espera el servicio de IA (Python): usa snake_case, por eso los
/// nombres van forzados con JsonPropertyName y no dependen del serializador.
/// </summary>
public class IaChatServicioRequest
{
    [JsonPropertyName("texto")]
    public string Texto { get; set; } = string.Empty;

    [JsonPropertyName("sesion_id")]
    public string SesionId { get; set; } = string.Empty;

    /// <summary>Se omite del JSON cuando no hay contexto (el agente responde genérico).</summary>
    [JsonPropertyName("contexto")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IaChatServicioContexto? Contexto { get; set; }
}

/// <summary>Contexto tal como lo espera el servicio de IA (claves en minúscula).</summary>
public class IaChatServicioContexto
{
    [JsonPropertyName("nombre")]
    public string? Nombre { get; set; }

    [JsonPropertyName("perfil")]
    public string? Perfil { get; set; }

    [JsonPropertyName("area")]
    public string? Area { get; set; }

    [JsonPropertyName("carrera")]
    public string? Carrera { get; set; }
}

/// <summary>
/// Resultado interno de la llamada a la IA. El controller lo traduce a 200 o a
/// 503; nunca se le devuelve al cliente el detalle del error.
/// </summary>
public class IaChatResultado
{
    public bool Exitoso { get; set; }
    public string Reply { get; set; } = string.Empty;

    public static IaChatResultado Ok(string reply) => new() { Exitoso = true, Reply = reply };
    public static IaChatResultado Fallo() => new() { Exitoso = false };
}
