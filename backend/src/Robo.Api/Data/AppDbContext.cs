using Microsoft.EntityFrameworkCore;
using Robo.Api.Data.Entities;

namespace Robo.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Robot> Robots { get; set; }
    public DbSet<Project> Projects { get; set; }
}