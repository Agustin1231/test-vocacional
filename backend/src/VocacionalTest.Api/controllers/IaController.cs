using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/ia")]
public class IaController : ControllerBase
{
    private readonly IIaService _iaService;

    public IaController(IIaService iaService)
    {
        _iaService = iaService;
    }

    /// <summary>
    /// Chat con el asesor IA. Es público, igual que el resto del flujo del
    /// estudiante: el backend hace de proxy y agrega la API key del servicio.
    /// </summary>
    [HttpPost("chat")]
    [AllowAnonymous]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> Chat([FromBody] IaChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Texto) || string.IsNullOrWhiteSpace(request.SesionId))
            return BadRequest(new { mensaje = "Se requieren los campos texto y sesionId." });

        // La IP real del estudiante (ya resuelta por UseForwardedHeaders) viaja
        // hacia el servicio de IA para que su rate limit sea por estudiante.
        request.IpCliente = HttpContext.Connection.RemoteIpAddress?.ToString();

        var resultado = await _iaService.EnviarMensajeAsync(request);

        if (!resultado.Exitoso)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                mensaje = "El asesor IA no está disponible en este momento. " +
                          "Intenta de nuevo en unos minutos."
            });

        return Ok(new IaChatResponse { Reply = resultado.Reply });
    }

    /// <summary>
    /// Instrucciones (system prompt) vigentes del agente.
    ///
    /// Proxy hacia el servicio de IA, que exige la clave compartida
    /// <c>X-API-Key</c>. El navegador no puede llamarlo directo sin llevar esa
    /// clave (ver <c>docs/adr/0002-backend-como-proxy-de-la-ia.md</c>), así que la
    /// agrega <c>IaService</c>.
    ///
    /// A diferencia del chat, esto **no** es anónimo: edita el comportamiento del
    /// asesor para todos los estudiantes, así que pide el rol de administrador y no
    /// solo un token válido.
    /// </summary>
    [HttpGet("instrucciones")]
    [Authorize(Roles = "Administrador")]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> LeerInstrucciones()
    {
        return TraducirInstrucciones(await _iaService.LeerInstruccionesAsync());
    }

    /// <summary>
    /// Reemplaza las instrucciones del agente. Aplican a partir del chat
    /// siguiente. Mismo permiso que el <c>GET</c>.
    /// </summary>
    [HttpPut("instrucciones")]
    [Authorize(Roles = "Administrador")]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> GuardarInstrucciones([FromBody] IaInstruccionesRequest request)
    {
        // [ApiController] ya devolvió 400 si el contenido venía vacío o pasado de
        // largo (ver las anotaciones de IaInstruccionesRequest).
        return TraducirInstrucciones(await _iaService.GuardarInstruccionesAsync(request.Contenido.Trim()));
    }

    // ----------------------------------------------------------------------- //
    // Documentos del plan de estudios (RAG)
    //
    // El agente los consulta solo; estos endpoints son para administrarlos desde
    // el panel. Mismo permiso que las instrucciones: cambian lo que el asesor le
    // dice a TODOS los estudiantes.
    // ----------------------------------------------------------------------- //

    /// <summary>
    /// Tope del cuerpo de la subida. Tiene que quedar por ENCIMA de
    /// `RAG_MAX_PDF_MB` del servicio de IA (hoy 20 MB), con margen para el
    /// envoltorio multipart: si el límite de acá fuera más chico, Kestrel cortaría
    /// la conexión y el panel vería un error de red en lugar del 413 con su motivo.
    ///
    /// Ojo: nginx tiene su propio límite (`client_max_body_size` en
    /// frontend/nginx.conf) y es el primero que se aplica.
    /// </summary>
    private const long MaximoSubidaBytes = 22L * 1024 * 1024;

    /// <summary>Documentos indexados que el agente puede consultar.</summary>
    [HttpGet("documentos")]
    [Authorize(Roles = "Administrador")]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> ListarDocumentos()
    {
        var resultado = await _iaService.ListarDocumentosAsync();
        return resultado.Estado == IaDocumentoEstado.Ok
            ? Ok(resultado.Documentos)
            : TraducirDocumentos(resultado);
    }

    /// <summary>
    /// Sube un PDF y lo deja indexado. El archivo viaja como `multipart/form-data`
    /// en el campo `archivo`.
    ///
    /// El PDF NO se guarda en el backend: se reenvía al servicio de IA, que es el
    /// dueño de la base de documentos. Por eso acá no hay carpeta de subidas ni
    /// volumen que respaldar.
    /// </summary>
    [HttpPost("documentos")]
    [Authorize(Roles = "Administrador")]
    [EnableRateLimiting("publico")]
    [RequestSizeLimit(MaximoSubidaBytes)]
    public async Task<IActionResult> SubirDocumento(IFormFile archivo)
    {
        if (archivo == null || archivo.Length == 0)
            return BadRequest(new { mensaje = "No llegó ningún archivo en el campo 'archivo'." });

        await using var contenido = archivo.OpenReadStream();
        var resultado = await _iaService.SubirDocumentoAsync(contenido, archivo.FileName);

        return resultado.Estado == IaDocumentoEstado.Ok
            ? StatusCode(StatusCodes.Status201Created, resultado.Documento)
            : TraducirDocumentos(resultado);
    }

    /// <summary>Borra un documento y sus fragmentos: el agente deja de verlo.</summary>
    [HttpDelete("documentos/{documentoId:long}")]
    [Authorize(Roles = "Administrador")]
    [EnableRateLimiting("publico")]
    public async Task<IActionResult> BorrarDocumento(long documentoId)
    {
        var resultado = await _iaService.BorrarDocumentoAsync(documentoId);
        return resultado.Estado == IaDocumentoEstado.Ok
            ? NoContent()
            : TraducirDocumentos(resultado);
    }

    /// <summary>
    /// Resultado interno -> código HTTP.
    ///
    /// Los errores del archivo se devuelven con su motivo, porque quien administra
    /// tiene que poder corregir el PDF que eligió. El 503 lleva un texto fijo del
    /// backend: ahí el detalle es de infraestructura y queda en el log.
    /// </summary>
    private IActionResult TraducirDocumentos(IaDocumentosResultado resultado) => resultado.Estado switch
    {
        IaDocumentoEstado.Duplicado => Conflict(new
        {
            mensaje = resultado.Mensaje ?? "Ya hay un documento con ese nombre o con ese mismo contenido."
        }),

        IaDocumentoEstado.ArchivoInvalido => UnprocessableEntity(new
        {
            mensaje = resultado.Mensaje ?? "El archivo no es un PDF con texto extraíble."
        }),

        IaDocumentoEstado.DemasiadoGrande => StatusCode(
            StatusCodes.Status413PayloadTooLarge,
            new { mensaje = resultado.Mensaje ?? "El PDF es demasiado grande." }),

        IaDocumentoEstado.NoEncontrado => NotFound(new
        {
            mensaje = "El documento no existe (puede haberlo borrado otra persona)."
        }),

        _ => StatusCode(StatusCodes.Status503ServiceUnavailable, new
        {
            mensaje = "No se pudo operar sobre la base de documentos. Revisá que el " +
                      "servicio de IA esté arriba y que tenga configurada VECTOR_STORE_URL."
        })
    };

    /// <summary>
    /// Resultado interno -> código HTTP. Se devuelve el cuerpo del servicio de IA
    /// tal cual, que es lo que el panel ya espera.
    /// </summary>
    private IActionResult TraducirInstrucciones(IaInstruccionesResultado resultado) => resultado.Estado switch
    {
        IaInstruccionesEstado.Ok => Ok(resultado.Datos),

        // 503 y NO 404 a propósito. El panel interpreta un 404 como "el backend
        // todavía no expone este proxy" (`fallo()` en admin.service.ts) y muestra
        // ese aviso, que sería justo lo contrario de lo que pasó: el proxy existe
        // y contestó, y lo que falta es el prompt del lado del servicio de IA.
        IaInstruccionesEstado.SinInstrucciones => StatusCode(
            StatusCodes.Status503ServiceUnavailable,
            new { mensaje = "El servicio de IA todavía no tiene instrucciones cargadas." }),

        _ => StatusCode(
            StatusCodes.Status503ServiceUnavailable,
            new
            {
                mensaje = "No se pudo contactar al servicio de IA para gestionar las " +
                          "instrucciones. Intenta de nuevo en unos minutos."
            })
    };
}
