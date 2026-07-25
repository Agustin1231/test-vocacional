using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface ICiudadService
{
    Task<List<CiudadDto>> ObtenerCiudadesAsync();
}