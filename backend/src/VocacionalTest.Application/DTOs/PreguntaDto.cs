namespace VocacionalTest.Application.DTOs;

public class PreguntaDto
{
    public int Id { get; set; }
    public string Enunciado { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public List<OpcionDto> Opciones { get; set; } = new();
}

public class OpcionDto
{
    public int Id { get; set; }
    public string Texto { get; set; } = string.Empty;
}