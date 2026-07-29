using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface IResultadoService
{
    Task<ResultadoResponseDto> RegistrarResultadoAsync(ResultadoRequest request);

    /// <summary>Listado paginado (1-based). El servicio recorta `tamano` a su tope.</summary>
    Task<List<ResultadoListItemDto>> ObtenerResultadosAsync(int pagina, int tamano);
}