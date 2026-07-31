using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface IIaService
{
    Task<IaChatResultado> EnviarMensajeAsync(IaChatRequest request);

    /// <summary>
    /// Instrucciones (system prompt) vigentes del agente. La lógica vive acá y no
    /// en el controller para que el <c>HttpClient</c> y la API key del servicio de
    /// IA no salgan de esta capa.
    /// </summary>
    Task<IaInstruccionesResultado> LeerInstruccionesAsync();

    /// <summary>
    /// Reemplaza las instrucciones del agente. Aplican en el chat siguiente: el
    /// servicio de IA las lee de su base en cada invocación del grafo.
    /// </summary>
    Task<IaInstruccionesResultado> GuardarInstruccionesAsync(string contenido);

    /// <summary>Documentos del plan de estudios indexados en el RAG.</summary>
    Task<IaDocumentosResultado> ListarDocumentosAsync();

    /// <summary>
    /// Sube un PDF al RAG para que el agente pueda consultarlo.
    ///
    /// Es la operación más lenta que hace el backend: el servicio de IA extrae el
    /// texto, lo trocea y pide un embedding por lote de fragmentos. Comparte el
    /// timeout de `IA_TIMEOUT_SEGUNDOS` con el chat.
    /// </summary>
    Task<IaDocumentosResultado> SubirDocumentoAsync(Stream contenido, string nombreArchivo);

    /// <summary>Borra un documento del RAG y todos sus fragmentos.</summary>
    Task<IaDocumentosResultado> BorrarDocumentoAsync(long documentoId);
}
