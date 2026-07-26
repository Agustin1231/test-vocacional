namespace VocacionalTest.Domain.Entities;

public class Respuesta
{
    public int Id { get; set; }

    public int? OpcionRespuestaId { get; set; }
    public OpcionRespuesta? OpcionRespuesta { get; set; }

    public int? PreguntaId { get; set; }
    public Pregunta? Pregunta { get; set; }

    public int? TestId { get; set; }
    public Test? Test { get; set; }
}