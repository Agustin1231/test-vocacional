namespace VocacionalTest.Domain.Entities;

public class Resultado
{
    public int Id { get; set; }
    public decimal Puntaje { get; set; }
    public decimal Porcentaje { get; set; }
    public DateTime Fecha { get; set; }

    public int? TestId { get; set; }
    public Test? Test { get; set; }

    public int? PerfilVocacionalId { get; set; }
    public PerfilVocacional? PerfilVocacional { get; set; }

    public int? ProgramaAcademicoId { get; set; }
    public ProgramaAcademico? ProgramaAcademico { get; set; }
}