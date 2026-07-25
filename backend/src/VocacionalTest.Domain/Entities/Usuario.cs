namespace VocacionalTest.Domain.Entities;

public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Apellido { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Telefono { get; set; } = string.Empty;
    public DateTime FechaRegistro { get; set; }
    public bool Estado { get; set; }
    public int Edad { get; set; }
    public string NumeroDocumento { get; set; } = string.Empty;
    public string InstitucionEducativa { get; set; } = string.Empty;

    public int? RolId { get; set; }
    public Rol? Rol { get; set; }

    public int? TipoDocumentoId { get; set; }
    public TipoDocumento? TipoDocumento { get; set; }

    public int? CiudadId { get; set; }
    public Ciudad? Ciudad { get; set; }

    public int? GradoId { get; set; }
    public Grado? Grado { get; set; }
}