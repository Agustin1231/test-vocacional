using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using VocacionalTest.Application.Interfaces;
using VocacionalTest.Infrastructure.Persistence;
using VocacionalTest.Infrastructure.Services;

// El .env solo existe en desarrollo y su ruta depende del directorio de trabajo.
// En el contenedor (WORKDIR /app) no hay ningún .env: las variables las inyecta
// Coolify, así que se carga únicamente si el archivo existe.
foreach (var rutaEnv in new[] { "../../.env", ".env" })
{
    if (File.Exists(rutaEnv))
    {
        DotNetEnv.Env.Load(rutaEnv);
        break;
    }
}

var builder = WebApplication.CreateBuilder(args);

// --- Base de datos ---
var dbHost = RequerirVariable("DB_HOST");
var dbName = RequerirVariable("DB_NAME");
var dbUser = RequerirVariable("DB_USER");
var dbPort = Environment.GetEnvironmentVariable("DB_PORT");
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? string.Empty;

if (string.IsNullOrWhiteSpace(dbPort))
    dbPort = "3306";

var connectionString = $"Server={dbHost};Port={dbPort};Database={dbName};User={dbUser};Password={dbPassword};";

// Versión declarada a mano: ServerVersion.AutoDetect abre una conexión a MySQL
// durante el arranque y, si la base todavía no está lista (compose recién
// levantado), el servicio no arranca.
var versionServidor = ServerVersion.Parse("8.0.36-mysql");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, versionServidor));

builder.Services.AddScoped<IPreguntaService, PreguntaService>();
builder.Services.AddScoped<IResultadoService, ResultadoService>();
builder.Services.AddScoped<ICiudadService, CiudadService>();
builder.Services.AddScoped<IGradoService, GradoService>();
builder.Services.AddScoped<ITipoDocumentoService, TipoDocumentoService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Proxy hacia el servicio de IA: el navegador no conoce la API key.
// El timeout tiene que ser MENOR que el proxy_read_timeout de nginx
// (frontend/nginx.conf: 120 s) y mayor que lo que tarda el modelo; si el backend
// corta antes, el estudiante ve un 503 aunque la IA haya respondido y guardado
// el turno.
var iaTimeout = LeerEntero("IA_TIMEOUT_SEGUNDOS", 110);

builder.Services.AddHttpClient<IIaService, IaService>(cliente =>
{
    cliente.Timeout = TimeSpan.FromSeconds(iaTimeout);
});

// --- Autenticación JWT ---
var jwtSigningKey = RequerirVariable("JWT_SIGNING_KEY");
var jwtIssuer = RequerirVariable("JWT_ISSUER");
var jwtAudience = RequerirVariable("JWT_AUDIENCE");

// HmacSha256 exige una clave de 256 bits: con menos, la firma del token falla.
if (Encoding.UTF8.GetByteCount(jwtSigningKey) < 32)
    throw new InvalidOperationException(
        "La variable de entorno JWT_SIGNING_KEY es demasiado corta: la firma HmacSha256 " +
        "necesita una clave de al menos 32 caracteres. Generá una más larga en el .env.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey))
    };
});

// --- CORS ---
// Lista de orígenes separados por comas. En dev alcanza con el Angular local.
// OJO: la variable puede existir y estar VACÍA (env_file con `CORS_ORIGINS=`),
// caso en el que `??` no aplica el default y quedaría una política con cero
// orígenes: el navegador rechazaría todo sin un solo log del lado servidor.
var corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS");

if (string.IsNullOrWhiteSpace(corsOrigins))
    corsOrigins = "http://localhost:4200";

var origenesPermitidos = corsOrigins
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

if (origenesPermitidos.Length == 0)
    throw new InvalidOperationException(
        "CORS_ORIGINS no contiene ningún origen válido. Dejala sin definir para usar " +
        "http://localhost:4200 o poné los orígenes separados por comas, sin barra final.");

builder.Services.AddCors(options =>
{
    // Sin AllowCredentials: la API se autentica con Bearer token, no con cookies.
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(origenesPermitidos)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// --- Cabeceras del proxy ---
// nginx (frontend/nginx.conf) manda X-Forwarded-For. Sin esto, RemoteIpAddress
// sería siempre la IP del contenedor de nginx y el rate limiter metería a TODOS
// los estudiantes en la misma cubeta: el primero que agote el límite bloquea al
// resto.
//
// La cabecera se acepta SOLO si viene de una red privada (el bridge de Docker /
// la red del reverse proxy). Vaciar KnownNetworks/KnownProxies la hacía
// confiable desde cualquier origen, y así se puede forjar una IP distinta en
// cada petición para saltear el rate limit del login. Las redes se pueden
// ajustar con TRUSTED_PROXY_NETWORKS ("172.16.0.0/12,10.0.0.0/8").
var redesProxy = (Environment.GetEnvironmentVariable("TRUSTED_PROXY_NETWORKS") is { } v
        && !string.IsNullOrWhiteSpace(v)
    ? v
    : "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();

    foreach (var red in redesProxy)
    {
        var partes = red.Split('/', 2);

        if (partes.Length == 2
            && System.Net.IPAddress.TryParse(partes[0], out var direccion)
            && int.TryParse(partes[1], out var prefijo))
        {
            options.KnownNetworks.Add(new IPNetwork(direccion, prefijo));
        }
        else if (System.Net.IPAddress.TryParse(red, out var unica))
        {
            options.KnownProxies.Add(unica);
        }
        else
        {
            throw new InvalidOperationException(
                $"TRUSTED_PROXY_NETWORKS trae un valor inválido: '{red}'. " +
                "Usá CIDR (172.16.0.0/12) o IPs sueltas separadas por comas.");
        }
    }
});

// --- Rate limiting ---
// Ventana fija por IP: protege el login de la fuerza bruta y el endpoint público
// de resultados del abuso.
var limiteLogin = LeerEntero("RATE_LIMIT_LOGIN_POR_MINUTO", 10);
var limitePublico = LeerEntero("RATE_LIMIT_PUBLICO_POR_MINUTO", 30);
// Techo por IP para TODO endpoint (catálogos, listados, endpoints nuevos): sin él
// un endpoint nace sin límite.
var limiteGlobal = LeerEntero("RATE_LIMIT_GLOBAL_POR_MINUTO", 120);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(contexto =>
        // El healthcheck no cuenta: lo llama el propio contenedor cada 15 s.
        contexto.Request.Path.StartsWithSegments("/health")
            ? RateLimitPartition.GetNoLimiter("health")
            : VentanaPorIp(contexto, limiteGlobal));

    options.OnRejected = async (contexto, cancelacion) =>
    {
        contexto.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await contexto.HttpContext.Response.WriteAsJsonAsync(
            new { mensaje = "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
            cancelacion);
    };

    options.AddPolicy<string>("login", contexto => VentanaPorIp(contexto, limiteLogin));
    options.AddPolicy<string>("publico", contexto => VentanaPorIp(contexto, limitePublico));
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Primero de todo: reescribe RemoteIpAddress con la IP real del cliente antes de
// que el rate limiter la use para particionar.
app.UseForwardedHeaders();

// Manejador de errores propio, en TODOS los entornos: sin esto un 500 sale con
// cuerpo vacío y sin log propio. Va antes que el resto para envolver todo el
// pipeline.
// OJO: en Development, WebApplication inserta su DeveloperExceptionPage ANTES de
// este middleware y gana, devolviendo el stack trace y el SQL con los datos del
// estudiante. Por eso el entorno por defecto del despliegue es Production
// (backend/.env.example e infra/docker-compose.yml lo fijan).
app.UseExceptionHandler(rama =>
{
    rama.Run(async contexto =>
    {
        var detalle = contexto.Features.Get<IExceptionHandlerFeature>()?.Error;
        app.Logger.LogError(detalle, "Error no manejado en {Ruta}.", contexto.Request.Path);

        contexto.Response.StatusCode = StatusCodes.Status500InternalServerError;
        contexto.Response.ContentType = "application/json";
        await contexto.Response.WriteAsJsonAsync(new
        {
            mensaje = "Ocurrió un error inesperado. Intenta de nuevo en unos minutos."
        });
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// UseCors va antes de la autenticación para que el navegador reciba las cabeceras
// incluso cuando la petición termina en 401.
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Healthcheck de Coolify: anónimo y sin tocar la base de datos.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous();

// Esquema + datos iniciales (catálogos, perfiles, programas, preguntas).
// Migrate aplica las migraciones pendientes y no hace nada si ya están aplicadas:
// sin esto el contenedor arranca contra una base vacía y todo endpoint que toque
// la base responde 500. Si falla, se registra y el servicio arranca igual (el
// /health sigue respondiendo y el contenedor no entra en reinicio infinito).
using (var alcance = app.Services.CreateScope())
{
    try
    {
        var contexto = alcance.ServiceProvider.GetRequiredService<AppDbContext>();
        await contexto.Database.MigrateAsync();
        await DbSeeder.SembrarAsync(contexto);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "No se pudo preparar la base de datos (migraciones o datos iniciales).");
    }
}

app.Run();

// --- Helpers de configuración ---

// Lee una variable obligatoria y falla con un mensaje claro si falta.
static string RequerirVariable(string nombre)
{
    var valor = Environment.GetEnvironmentVariable(nombre);

    if (string.IsNullOrWhiteSpace(valor))
        throw new InvalidOperationException(
            $"Falta la variable de entorno {nombre}. Definila en el .env (desarrollo) " +
            "o en las variables del contenedor (producción).");

    return valor;
}

// Lee un entero de una variable de entorno; usa el default si no es válido.
static int LeerEntero(string nombre, int porDefecto)
{
    return int.TryParse(Environment.GetEnvironmentVariable(nombre), out var valor) && valor > 0
        ? valor
        : porDefecto;
}

// Partición del rate limiter: una ventana de un minuto por IP.
static RateLimitPartition<string> VentanaPorIp(HttpContext contexto, int limite)
{
    var clave = contexto.Connection.RemoteIpAddress?.ToString() ?? "desconocida";

    return RateLimitPartition.GetFixedWindowLimiter(clave, _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = limite,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0
    });
}
