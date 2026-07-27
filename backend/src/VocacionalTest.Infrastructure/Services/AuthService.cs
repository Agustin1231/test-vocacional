using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using VocacionalTest.Application.DTOs;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Infrastructure.Persistence;

namespace VocacionalTest.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;

    public AuthService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var usuario = await _context.Usuarios
            .Include(u => u.Rol)
            .FirstOrDefaultAsync(u => u.Correo == request.Correo && u.Estado);

        if (usuario == null)
            return null;

        bool passwordValida = BCrypt.Net.BCrypt.Verify(request.Password, usuario.PasswordHash);
        if (!passwordValida)
            return null;

        var token = GenerarToken(usuario.Id, usuario.Correo, usuario.Rol?.Nombre ?? "SinRol");

        return new LoginResponse
        {
            Token = token,
            Rol = usuario.Rol?.Nombre ?? "SinRol",
            Nombre = $"{usuario.Nombre} {usuario.Apellido}"
        };
    }

    private string GenerarToken(int userId, string correo, string rol)
    {
        var signingKey = Environment.GetEnvironmentVariable("JWT_SIGNING_KEY")!;
        var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER")!;
        var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE")!;
        var expiresMinutes = int.Parse(Environment.GetEnvironmentVariable("JWT_EXPIRES_MINUTES") ?? "120");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Email, correo),
            new Claim(ClaimTypes.Role, rol)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}