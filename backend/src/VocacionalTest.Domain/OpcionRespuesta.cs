namespace VocacionalTest.Domain.Entities;

public class OpcionRespuesta
{
    public int Id { get; set; }
    public string Texto { get; set; } = string.Empty;
    public int Valor { get; set; }

    public int? PreguntaId { get; set; }
    public Pregunta? Pregunta { get; set; }
}