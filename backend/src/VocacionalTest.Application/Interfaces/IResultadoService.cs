using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface IResultadoService
{
    Task<ResultadoResponseDto> RegistrarResultadoAsync(ResultadoRequest request);
}