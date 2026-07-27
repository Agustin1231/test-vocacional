using VocacionalTest.Application.DTOs;

namespace VocacionalTest.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
}