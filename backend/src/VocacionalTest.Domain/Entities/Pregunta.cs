namespace VocacionalTest.Domain.Entities;

public class Pregunta
{
    public int Id { get; set; }
    public string Enunciado { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public bool Estado { get; set; }

    public ICollection<OpcionRespuesta> Opciones { get; set; } = new List<OpcionRespuesta>();
}