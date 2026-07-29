using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface IIaService
{
    Task<IaChatResultado> EnviarMensajeAsync(IaChatRequest request);
}
