namespace VocacionalTest.Domain.Entities;

public class PerfilVocacional
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;

    public ICollection<ProgramaAcademico> Programas { get; set; } = new List<ProgramaAcademico>();
}