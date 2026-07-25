namespace VocacionalTest.Domain.Entities;

public class Auditoria
{
    public int Id { get; set; }
    public string Accion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public string DireccionIP { get; set; } = string.Empty;

    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
}