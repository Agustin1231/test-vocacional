using Microsoft.EntityFrameworkCore;

namespace VocacionalTest.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
}