using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface IGradoService
{
    Task<List<GradoDto>> ObtenerGradosAsync();
}