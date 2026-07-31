using System.Text.Json.Serialization;

namespace VocacionalTest.Application.DTOs;

/// <summary>
/// Documento del plan de estudios indexado en el RAG, tal como lo devuelve el
/// servicio de IA. Claves en snake_case forzadas: el servicio de IA es Python y
/// se reenvía su cuerpo sin renombrar, igual que con las instrucciones.
///
/// <c>fragmentos</c> es el dato que importa mirar en el panel: es la cantidad de
/// trozos embebidos. Un documento con 0 fragmentos está subido pero el agente no
/// lo puede consultar.
/// </summary>
public class IaDocumentoDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [JsonPropertyName("tamano_bytes")]
    public long TamanoBytes { get; set; }

    [JsonPropertyName("paginas")]
    public int Paginas { get; set; }

    [JsonPropertyName("fragmentos")]
    public int Fragmentos { get; set; }

    [JsonPropertyName("modelo_embedding")]
    public string ModeloEmbedding { get; set; } = string.Empty;

    [JsonPropertyName("dimensiones")]
    public int Dimensiones { get; set; }

    [JsonPropertyName("subido_en")]
    public string? SubidoEn { get; set; }
}

/// <summary>Cuerpo de error de FastAPI: <c>{ "detail": "..." }</c>.</summary>
public class IaDetalleError
{
    [JsonPropertyName("detail")]
    public string? Detail { get; set; }
}

/// <summary>
/// Qué pasó al operar sobre los documentos.
///
/// A diferencia del chat —que colapsa cualquier falla en un 503 genérico— acá los
/// errores del cliente se distinguen y su motivo SÍ se le muestra a quien
/// administra: "ya existe un documento con ese nombre" o "el PDF es un escaneo sin
/// texto" son cosas que el administrador tiene que leer para corregir el archivo
/// que acaba de elegir, no detalles internos de infraestructura.
/// </summary>
public enum IaDocumentoEstado
{
    Ok,

    /// <summary>El servicio de IA o su base de documentos no respondieron.</summary>
    NoDisponible,

    /// <summary>Ya hay un documento con ese nombre o con ese mismo contenido.</summary>
    Duplicado,

    /// <summary>No es un PDF, está vacío, o es un escaneo del que no se saca texto.</summary>
    ArchivoInvalido,

    /// <summary>Pasa el tope de tamaño configurado.</summary>
    DemasiadoGrande,

    /// <summary>El documento que se quiso borrar no existe.</summary>
    NoEncontrado
}

/// <summary>Ver <see cref="IaDocumentoEstado"/>.</summary>
public class IaDocumentosResultado
{
    public IaDocumentoEstado Estado { get; set; }

    /// <summary>Motivo apto para mostrarle al administrador. Null si salió bien.</summary>
    public string? Mensaje { get; set; }

    /// <summary>El documento recién indexado (solo en la subida).</summary>
    public IaDocumentoDto? Documento { get; set; }

    /// <summary>El listado completo (solo al listar).</summary>
    public List<IaDocumentoDto> Documentos { get; set; } = new();

    public static IaDocumentosResultado Ok() => new() { Estado = IaDocumentoEstado.Ok };

    public static IaDocumentosResultado Lista(List<IaDocumentoDto> documentos) =>
        new() { Estado = IaDocumentoEstado.Ok, Documentos = documentos };

    public static IaDocumentosResultado Subido(IaDocumentoDto documento) =>
        new() { Estado = IaDocumentoEstado.Ok, Documento = documento };

    public static IaDocumentosResultado Fallo(IaDocumentoEstado estado, string? mensaje = null) =>
        new() { Estado = estado, Mensaje = mensaje };
}
