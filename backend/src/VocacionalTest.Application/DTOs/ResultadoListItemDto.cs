namespace VocacionalTest.Application.DTOs;

public class ResultadoListItemDto
{
    public int Id { get; set; }
    public string NombreEstudiante { get; set; } = string.Empty;
    public string CorreoEstudiante { get; set; } = string.Empty;
    public decimal Puntaje { get; set; }
    public decimal Porcentaje { get; set; }
    public string? PerfilVocacional { get; set; }
    public string? ProgramaAcademico { get; set; }
    public string Fecha { get; set; } = string.Empty;

    // Datos del formulario de registro. El panel ya tiene columnas para los tres
    // últimos y los mostraba vacíos porque este DTO no los traía, aunque estaban
    // guardados en `Usuarios` con sus FKs resueltas.
    //
    // Celular y Colegio salen de columnas de texto que el estudiante puede dejar
    // en blanco (llegan como cadena vacía, no null). Ciudad y Grado salen de los
    // catálogos: quedan en null cuando el texto enviado no coincidió con ninguna
    // fila, que es el modo de falla descrito en api-contract.md.
    public string? Celular { get; set; }
    public string? Colegio { get; set; }
    public string? Ciudad { get; set; }
    public string? Grado { get; set; }
}