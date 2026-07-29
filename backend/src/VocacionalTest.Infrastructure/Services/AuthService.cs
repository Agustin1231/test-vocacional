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
            .AsNoTracking()
            .Include(u => u.Rol)
            .FirstOrDefaultAsync(u => u.Correo == request.Correo && u.Estado);

        if (usuario == null)
            return null;

        // Los estudiantes que registra POST /api/resultados quedan sin contraseña:
        // no son cuentas y no pueden loguearse. Además, BCrypt.Verify con un hash
        // vacío lanza excepción (500), así que este guard va antes de verificar.
        if (string.IsNullOrWhiteSpace(usuario.PasswordHash))
            return null;

        bool passwordValida;
        try
        {
            passwordValida = BCrypt.Net.BCrypt.Verify(request.Password, usuario.PasswordHash);
        }
        catch (Exception)
        {
            // Hash con formato inválido o corrupto: se trata como credencial incorrecta.
            return null;
        }

        if (!passwordValida)
            return null;

        var token = GenerarToken(usuario.Id, usuario.Correo, usuario.Rol?.Nombre);

        return new LoginResponse
        {
            Token = token,
            Rol = usuario.Rol?.Nombre ?? "SinRol",
            Nombre = $"{usuario.Nombre} {usuario.Apellido}"
        };
    }

    /// <summary>
    /// Emite el JWT. Si el usuario no tiene rol NO se agrega el claim de rol: un
    /// "SinRol" sería un rol como cualquier otro y podría satisfacer un
    /// [Authorize(Roles = ...)] mal escrito.
    /// </summary>
    private string GenerarToken(int userId, string correo, string? rol)
    {
        var signingKey = Environment.GetEnvironmentVariable("JWT_SIGNING_KEY")!;
        var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER")!;
        var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE")!;
        // Si la variable no está o trae basura, se usan 120 minutos en vez de reventar.
        if (!int.TryParse(Environment.GetEnvironmentVariable("JWT_EXPIRES_MINUTES"), out var expiresMinutes) || expiresMinutes <= 0)
            expiresMinutes = 120;

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Email, correo)
        };

        if (!string.IsNullOrWhiteSpace(rol))
            claims.Add(new Claim(ClaimTypes.Role, rol));

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