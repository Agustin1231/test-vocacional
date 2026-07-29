using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;

namespace VocacionalTest.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    // Limitado por IP: es la puerta que más se intenta abrir por fuerza bruta.
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);

        if (result == null)
            return Unauthorized(new { mensaje = "Correo o contraseña incorrectos" });

        return Ok(result);
    }
}