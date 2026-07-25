namespace VocacionalTest.Domain.Entities;

public class ChatbotConversacion
{
    public int Id { get; set; }
    public string MensajeUsuario { get; set; } = string.Empty;
    public string RespuestaIA { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }

    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
}