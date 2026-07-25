namespace VocacionalTest.Api.DTOs;

public class ResultadoRequest
{
    public RegistroDto Registro { get; set; } = new();
    public List<RespuestaDto> Respuestas { get; set; } = new();
    public ResultadoDto Resultado { get; set; } = new();
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

public class RespuestaDto
{
    public int PreguntaId { get; set; }
    public int OpcionRespuestaId { get; set; }
}

public class ResultadoDto
{
    public decimal Puntaje { get; set; }
    public decimal Porcentaje { get; set; }
    public int? PerfilVocacionalId { get; set; }
    public int? ProgramaAcademicoId { get; set; }
}