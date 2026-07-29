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

    public async Task<IaChatResultado> EnviarMensajeAsync(IaChatRequest request)
    {
        var baseUrl = Environment.GetEnvironmentVariable("IA_BASE_URL");
        var apiKey = Environment.GetEnvironmentVariable("IA_API_KEY");

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            _logger.LogError("Falta la variable IA_BASE_URL: el asesor IA no está configurado.");
            return IaChatResultado.Fallo();
        }

        var url = $"{baseUrl.TrimEnd('/')}/api/ia/chat";

        try
        {
            using var peticion = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent.Create(new IaChatServicioRequest
                {
                    Texto = request.Texto,
                    SesionId = request.SesionId,
                    Contexto = TraducirContexto(request.Contexto)
                })
            };

            if (!string.IsNullOrWhiteSpace(apiKey))
                peticion.Headers.Add("X-API-Key", apiKey);

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
