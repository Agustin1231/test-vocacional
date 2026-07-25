namespace VocacionalTest.Domain.Entities;

public class Test
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public bool Estado { get; set; }

    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
}