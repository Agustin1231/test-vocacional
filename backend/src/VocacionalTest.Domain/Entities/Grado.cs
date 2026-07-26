namespace VocacionalTest.Domain.Entities;

public class Grado
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;

    public ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();
}