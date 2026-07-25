namespace VocacionalTest.Domain.Entities;

public class ProgramaAcademico
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Facultad { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string CampoLaboral { get; set; } = string.Empty;

    public int? PerfilVocacionalId { get; set; }
    public PerfilVocacional? PerfilVocacional { get; set; }
}