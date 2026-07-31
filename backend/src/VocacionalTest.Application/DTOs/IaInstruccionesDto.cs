using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace VocacionalTest.Application.DTOs;

/// <summary>
/// Instrucciones del agente (system prompt) tal como las expone el servicio de
/// IA. Se devuelven al panel sin renombrar nada: <c>actualizado_en</c> va forzado
/// con <see cref="JsonPropertyName"/> porque el serializador del backend escribe
/// camelCase y el panel lee la clave en snake_case (interfaz
/// <c>InstruccionesAgente</c> en <c>core/services/admin.service.ts</c>).
///
/// El mismo tipo sirve para leer la respuesta del servicio de IA y para
/// devolverla, justamente porque las dos puntas usan las mismas claves.
/// </summary>
public class IaInstruccionesDto
{
    [JsonPropertyName("clave")]
    public string Clave { get; set; } = string.Empty;

    [JsonPropertyName("contenido")]
    public string Contenido { get; set; } = string.Empty;

    /// <summary>
    /// Puede venir en null: en el servicio de IA es <c>str | None</c>
    /// (<c>ia/app/schemas.py</c>, <c>InstruccionResponse</c>).
    /// </summary>
    [JsonPropertyName("actualizado_en")]
    public string? ActualizadoEn { get; set; }
}

/// <summary>
/// Cuerpo de <c>PUT /api/ia/instrucciones</c>. Un solo tipo para las dos puntas:
/// es lo que manda el panel y lo que espera el servicio de IA, y las dos usan
/// <c>contenido</c>.
///
/// El largo máximo es del backend, no del servicio de IA (que no valida): sin
/// tope, el prompt entero viaja al modelo en cada turno del chat.
/// </summary>
public class IaInstruccionesRequest
{
    [Required(ErrorMessage = "El contenido de las instrucciones es obligatorio.")]
    [StringLength(20000, MinimumLength = 1)]
    [JsonPropertyName("contenido")]
    public string Contenido { get; set; } = string.Empty;
}

/// <summary>
/// Resultado interno del proxy de instrucciones. El controller lo traduce a un
/// código HTTP; el detalle del fallo queda en el log y nunca se le devuelve al
/// cliente, igual que en el chat.
/// </summary>
public enum IaInstruccionesEstado
{
    /// <summary>El servicio de IA respondió con las instrucciones.</summary>
    Ok,

    /// <summary>
    /// El servicio de IA respondió bien, pero no tiene ningún prompt guardado
    /// (su <c>GET</c> devuelve 404). Es distinto de no poder contactarlo.
    /// </summary>
    SinInstrucciones,

    /// <summary>No se pudo contactar al servicio de IA, o contestó un error.</summary>
    NoDisponible
}

/// <summary>Ver <see cref="IaInstruccionesEstado"/>.</summary>
public class IaInstruccionesResultado
{
    public IaInstruccionesEstado Estado { get; set; }
    public IaInstruccionesDto? Datos { get; set; }

    public static IaInstruccionesResultado Ok(IaInstruccionesDto datos) =>
        new() { Estado = IaInstruccionesEstado.Ok, Datos = datos };

    public static IaInstruccionesResultado SinInstrucciones() =>
        new() { Estado = IaInstruccionesEstado.SinInstrucciones };

    public static IaInstruccionesResultado NoDisponible() =>
        new() { Estado = IaInstruccionesEstado.NoDisponible };
}
