using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface IPreguntaService
{
    Task<List<PreguntaDto>> ObtenerPreguntasActivasAsync();
}