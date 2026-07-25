using Microsoft.EntityFrameworkCore;
using VocacionalTest.Domain.Entities;

namespace VocacionalTest.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<TipoDocumento> TiposDocumento => Set<TipoDocumento>();
    public DbSet<Ciudad> Ciudades => Set<Ciudad>();
    public DbSet<Grado> Grados => Set<Grado>();
    public DbSet<Rol> Roles => Set<Rol>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Pregunta> Preguntas => Set<Pregunta>();
    public DbSet<OpcionRespuesta> OpcionesRespuesta => Set<OpcionRespuesta>();
    public DbSet<PerfilVocacional> PerfilesVocacionales => Set<PerfilVocacional>();
    public DbSet<ProgramaAcademico> ProgramasAcademicos => Set<ProgramaAcademico>();
    public DbSet<Test> Tests => Set<Test>();
    public DbSet<Respuesta> Respuestas => Set<Respuesta>();
    public DbSet<Resultado> Resultados => Set<Resultado>();
    public DbSet<Auditoria> Auditorias => Set<Auditoria>();
    public DbSet<ChatbotConversacion> ChatbotConversaciones => Set<ChatbotConversacion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Usuario>()
            .HasIndex(u => u.Correo)
            .IsUnique();

        modelBuilder.Entity<Usuario>()
            .HasIndex(u => new { u.TipoDocumentoId, u.NumeroDocumento })
            .IsUnique();
    }
}