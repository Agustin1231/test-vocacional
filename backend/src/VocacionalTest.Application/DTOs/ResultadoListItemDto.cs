namespace VocacionalTest.Application.DTOs;

public class ResultadoListItemDto
{
    public int Id { get; set; }
    public string NombreEstudiante { get; set; } = string.Empty;
    public string CorreoEstudiante { get; set; } = string.Empty;
    public decimal Puntaje { get; set; }
    public decimal Porcentaje { get; set; }
    public string? PerfilVocacional { get; set; }
    public string? ProgramaAcademico { get; set; }
    public string Fecha { get; set; } = string.Empty;
}