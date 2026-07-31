using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Domain.Entities;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

/// <summary>
/// Proxy hacia el servicio de IA (Python). El navegador nunca ve la API key:
/// se agrega acá, leyéndola de las variables de entorno.
/// </summary>
public class IaService : IIaService
{
    /// <summary>
    /// Cabecera con la IP real del estudiante. El servicio de IA la usa como clave
    /// de su rate limit: sin ella solo vería la IP del backend y el límite sería
    /// global (un estudiante agotaría la cuota de todos).
    /// </summary>
    public const string CabeceraIpCliente = "X-Cliente-IP";

    private readonly HttpClient _httpClient;
    private readonly AppDbContext _context;
    private readonly ILogger<IaService> _logger;

    public IaService(HttpClient httpClient, AppDbContext context, ILogger<IaService> logger)
    {
        _httpClient = httpClient;
        _context = context;
        _logger = logger;
    }

    /// <summary>Ruta de las instrucciones en el servicio de IA (GET y PUT).</summary>
    private const string RutaInstrucciones = "/api/ia/instrucciones";

    /// <summary>
    /// Arma una petición hacia el servicio de IA con la API key ya puesta. El
    /// navegador nunca ve esa clave: se agrega únicamente acá.
    ///
    /// Devuelve null si falta <c>IA_BASE_URL</c>, que es un error de configuración
    /// del despliegue y no del cliente. Cada método decide qué contestar entonces.
    /// </summary>
    private HttpRequestMessage? CrearPeticion(HttpMethod metodo, string ruta)
    {
        var baseUrl = Environment.GetEnvironmentVariable("IA_BASE_URL");
        var apiKey = Environment.GetEnvironmentVariable("IA_API_KEY");

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            _logger.LogError("Falta la variable IA_BASE_URL: el servicio de IA no está configurado.");
            return null;
        }

        var peticion = new HttpRequestMessage(metodo, $"{baseUrl.TrimEnd('/')}{ruta}");

        if (!string.IsNullOrWhiteSpace(apiKey))
            peticion.Headers.Add("X-API-Key", apiKey);

        return peticion;
    }

    public async Task<IaChatResultado> EnviarMensajeAsync(IaChatRequest request)
    {
        try
        {
            using var peticion = CrearPeticion(HttpMethod.Post, "/api/ia/chat");
            if (peticion == null)
                return IaChatResultado.Fallo();

            peticion.Content = JsonContent.Create(new IaChatServicioRequest
            {
                Texto = request.Texto,
                SesionId = request.SesionId,
                Contexto = TraducirContexto(request.Contexto)
            });

            // La pone el controller a partir de HttpContext (ver IaController).
            if (!string.IsNullOrWhiteSpace(request.IpCliente))
                peticion.Headers.Add(CabeceraIpCliente, request.IpCliente);

            using var respuesta = await _httpClient.SendAsync(peticion);

            if (!respuesta.IsSuccessStatusCode)
            {
                // Solo el código de estado: el body podría traer datos sensibles.
                _logger.LogWarning("El servicio de IA respondió {Codigo}.", (int)respuesta.StatusCode);
                return IaChatResultado.Fallo();
            }

            var contenido = await respuesta.Content.ReadFromJsonAsync<IaChatResponse>();
            var reply = contenido?.Reply?.Trim();

            if (string.IsNullOrEmpty(reply))
            {
                _logger.LogWarning("El servicio de IA devolvió una respuesta vacía.");
                return IaChatResultado.Fallo();
            }

            await GuardarConversacionAsync(request.Texto, reply);

            return IaChatResultado.Ok(reply);
        }
        catch (Exception ex)
        {
            // Se registra el tipo de error, nunca el mensaje completo ni la API key.
            _logger.LogWarning("No se pudo contactar al servicio de IA ({Error}).", ex.GetType().Name);
            return IaChatResultado.Fallo();
        }
    }

    public async Task<IaInstruccionesResultado> LeerInstruccionesAsync()
    {
        try
        {
            using var peticion = CrearPeticion(HttpMethod.Get, RutaInstrucciones);
            if (peticion == null)
                return IaInstruccionesResultado.NoDisponible();

            using var respuesta = await _httpClient.SendAsync(peticion);

            // 404 del servicio de IA: contestó bien, pero no tiene ningún prompt
            // guardado. Se distingue del fallo de contacto porque el panel puede
            // ofrecer crear uno en vez de decir que el asesor está caído.
            if (respuesta.StatusCode == HttpStatusCode.NotFound)
                return IaInstruccionesResultado.SinInstrucciones();

            if (!respuesta.IsSuccessStatusCode)
            {
                // Solo el código: el body podría traer detalle de configuración.
                _logger.LogWarning(
                    "El servicio de IA respondió {Codigo} al leer las instrucciones.",
                    (int)respuesta.StatusCode);
                return IaInstruccionesResultado.NoDisponible();
            }

            var datos = await respuesta.Content.ReadFromJsonAsync<IaInstruccionesDto>();

            if (datos == null || string.IsNullOrWhiteSpace(datos.Contenido))
            {
                _logger.LogWarning("El servicio de IA devolvió instrucciones vacías.");
                return IaInstruccionesResultado.SinInstrucciones();
            }

            return IaInstruccionesResultado.Ok(datos);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                "No se pudieron leer las instrucciones del servicio de IA ({Error}).",
                ex.GetType().Name);
            return IaInstruccionesResultado.NoDisponible();
        }
    }

    public async Task<IaInstruccionesResultado> GuardarInstruccionesAsync(string contenido)
    {
        try
        {
            using var peticion = CrearPeticion(HttpMethod.Put, RutaInstrucciones);
            if (peticion == null)
                return IaInstruccionesResultado.NoDisponible();

            peticion.Content = JsonContent.Create(new IaInstruccionesRequest { Contenido = contenido });

            using var respuesta = await _httpClient.SendAsync(peticion);

            // Acá un 404 no es "no hay prompt": el PUT lo crea si no existe. Si
            // llegara, es que la ruta cambió en el servicio de IA.
            if (!respuesta.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "El servicio de IA respondió {Codigo} al guardar las instrucciones.",
                    (int)respuesta.StatusCode);
                return IaInstruccionesResultado.NoDisponible();
            }

            var datos = await respuesta.Content.ReadFromJsonAsync<IaInstruccionesDto>();

            if (datos == null)
            {
                _logger.LogWarning("El servicio de IA no devolvió las instrucciones guardadas.");
                return IaInstruccionesResultado.NoDisponible();
            }

            return IaInstruccionesResultado.Ok(datos);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                "No se pudieron guardar las instrucciones en el servicio de IA ({Error}).",
                ex.GetType().Name);
            return IaInstruccionesResultado.NoDisponible();
        }
    }

    // ----------------------------------------------------------------------- //
    // Documentos del RAG (plan de estudios)
    //
    // Diferencia con el chat y con las instrucciones: acá los errores del cliente
    // SÍ se traducen a un motivo concreto. "Ya existe un documento con ese nombre"
    // o "el PDF es un escaneo sin texto" son cosas que quien administra necesita
    // leer para corregir el archivo que eligió, no detalles de infraestructura.
    // Lo que se sigue ocultando es el 503: ahí el motivo va al log.
    // ----------------------------------------------------------------------- //

    private const string RutaDocumentos = "/api/ia/documentos";

    /// <summary>
    /// Traduce el código del servicio de IA al estado interno, y saca el motivo del
    /// cuerpo de FastAPI (<c>{ "detail": "..." }</c>) cuando corresponde mostrarlo.
    /// </summary>
    private async Task<IaDocumentosResultado> TraducirFalloAsync(
        HttpResponseMessage respuesta, string operacion)
    {
        var codigo = (int)respuesta.StatusCode;
        string? detalle = null;

        try
        {
            var cuerpo = await respuesta.Content.ReadFromJsonAsync<IaDetalleError>();
            detalle = cuerpo?.Detail;
        }
        catch (Exception)
        {
            // El cuerpo no era el JSON esperado. No es motivo para fallar distinto.
        }

        _logger.LogWarning(
            "El servicio de IA respondió {Codigo} al {Operacion} documentos.", codigo, operacion);

        return respuesta.StatusCode switch
        {
            HttpStatusCode.Conflict =>
                IaDocumentosResultado.Fallo(IaDocumentoEstado.Duplicado, detalle),
            HttpStatusCode.UnsupportedMediaType or HttpStatusCode.UnprocessableEntity =>
                IaDocumentosResultado.Fallo(IaDocumentoEstado.ArchivoInvalido, detalle),
            HttpStatusCode.RequestEntityTooLarge =>
                IaDocumentosResultado.Fallo(IaDocumentoEstado.DemasiadoGrande, detalle),
            HttpStatusCode.NotFound =>
                IaDocumentosResultado.Fallo(IaDocumentoEstado.NoEncontrado, detalle),
            // Todo lo demás (503, 401, 500...) es un problema del despliegue: el
            // motivo queda en el log y al cliente le va un mensaje fijo del backend.
            _ => IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible)
        };
    }

    public async Task<IaDocumentosResultado> ListarDocumentosAsync()
    {
        try
        {
            using var peticion = CrearPeticion(HttpMethod.Get, RutaDocumentos);
            if (peticion == null)
                return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);

            using var respuesta = await _httpClient.SendAsync(peticion);

            if (!respuesta.IsSuccessStatusCode)
                return await TraducirFalloAsync(respuesta, "listar");

            var documentos = await respuesta.Content.ReadFromJsonAsync<List<IaDocumentoDto>>();
            return IaDocumentosResultado.Lista(documentos ?? new List<IaDocumentoDto>());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                "No se pudo listar los documentos del RAG ({Error}).", ex.GetType().Name);
            return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);
        }
    }

    public async Task<IaDocumentosResultado> SubirDocumentoAsync(
        Stream contenido, string nombreArchivo)
    {
        try
        {
            using var peticion = CrearPeticion(HttpMethod.Post, RutaDocumentos);
            if (peticion == null)
                return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);

            // El nombre del campo tiene que ser `archivo`: es el parámetro que
            // declara el endpoint de FastAPI. Con otro nombre devuelve 422.
            using var formulario = new MultipartFormDataContent();
            var archivo = new StreamContent(contenido);
            archivo.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            formulario.Add(archivo, "archivo", nombreArchivo);
            peticion.Content = formulario;

            using var respuesta = await _httpClient.SendAsync(peticion);

            if (!respuesta.IsSuccessStatusCode)
                return await TraducirFalloAsync(respuesta, "subir");

            var documento = await respuesta.Content.ReadFromJsonAsync<IaDocumentoDto>();
            if (documento == null)
            {
                _logger.LogWarning("El servicio de IA no devolvió el documento indexado.");
                return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);
            }

            _logger.LogInformation(
                "RAG: indexado '{Nombre}' ({Fragmentos} fragmentos).",
                documento.Nombre, documento.Fragmentos);
            return IaDocumentosResultado.Subido(documento);
        }
        catch (TaskCanceledException)
        {
            // Timeout del HttpClient (IA_TIMEOUT_SEGUNDOS). Vale la pena
            // distinguirlo en el log: con un PDF grande es el fallo esperable.
            _logger.LogWarning(
                "Se agotó el tiempo indexando '{Nombre}'. Puede ser un PDF demasiado " +
                "grande para IA_TIMEOUT_SEGUNDOS.", nombreArchivo);
            return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("No se pudo subir el documento ({Error}).", ex.GetType().Name);
            return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);
        }
    }

    public async Task<IaDocumentosResultado> BorrarDocumentoAsync(long documentoId)
    {
        try
        {
            using var peticion = CrearPeticion(
                HttpMethod.Delete, $"{RutaDocumentos}/{documentoId}");
            if (peticion == null)
                return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);

            using var respuesta = await _httpClient.SendAsync(peticion);

            if (!respuesta.IsSuccessStatusCode)
                return await TraducirFalloAsync(respuesta, "borrar");

            _logger.LogInformation("RAG: borrado el documento {Id}.", documentoId);
            return IaDocumentosResultado.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("No se pudo borrar el documento ({Error}).", ex.GetType().Name);
            return IaDocumentosResultado.Fallo(IaDocumentoEstado.NoDisponible);
        }
    }

    /// <summary>
    /// Contexto del navegador -> contexto del servicio de IA. Si no llega nada
    /// aprovechable devuelve null y el campo se omite del JSON: el agente
    /// responde en modo genérico en vez de con datos inventados.
    /// </summary>
    private static IaChatServicioContexto? TraducirContexto(IaChatContextoDto? contexto)
    {
        if (contexto == null || !contexto.TieneDatos())
            return null;

        return new IaChatServicioContexto
        {
            Nombre = contexto.Nombre?.Trim(),
            Perfil = contexto.Perfil?.Trim(),
            Area = contexto.Area?.Trim(),
            Carrera = contexto.Carrera?.Trim()
        };
    }

    /// <summary>
    /// Auditoría de la conversación. Es "best effort": si falla el guardado, el
    /// estudiante igual recibe su respuesta.
    /// </summary>
    private async Task GuardarConversacionAsync(string mensaje, string respuesta)
    {
        try
        {
            _context.ChatbotConversaciones.Add(new ChatbotConversacion
            {
                MensajeUsuario = mensaje,
                RespuestaIA = respuesta,
                Fecha = DateTime.UtcNow,
                // TODO: el chat del estudiante es anónimo; asociar el UsuarioId
                // cuando el flujo pase por un usuario identificado.
                UsuarioId = null
            });

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("No se pudo guardar la conversación del chatbot ({Error}).", ex.GetType().Name);
        }
    }
}
