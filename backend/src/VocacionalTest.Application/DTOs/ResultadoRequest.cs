namespace VocacionalTest.Application.DTOs;

public class ResultadoRequest
{
    public RegistroDto Registro { get; set; } = new();
    public List<RespuestaItemDto> Respuestas { get; set; } = new();
    public ResultadoDatosDto Resultado { get; set; } = new();
}

public class RegistroDto
{
    public string Nombre { get; set; } = string.Empty;
    public string Apellido { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string Telefono { get; set; } = string.Empty;
    public int Edad { get; set; }
    public string NumeroDocumento { get; set; } = string.Empty;
    public int? TipoDocumentoId { get; set; }
    public int? CiudadId { get; set; }
    public int? GradoId { get; set; }
    public string InstitucionEducativa { get; set; } = string.Empty;
}

public class RespuestaItemDto
{
    public int PreguntaId { get; set; }
    public int OpcionRespuestaId { get; set; }
}

public class ResultadoDatosDto
{
    public decimal Puntaje { get; set; }
    public decimal Porcentaje { get; set; }
    public int? PerfilVocacionalId { get; set; }
    public int? ProgramaAcademicoId { get; set; }
}