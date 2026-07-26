using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface ITipoDocumentoService
{
    Task<List<TipoDocumentoDto>> ObtenerTiposDocumentoAsync();
}