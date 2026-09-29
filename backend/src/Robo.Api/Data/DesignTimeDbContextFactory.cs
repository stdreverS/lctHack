using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Robo.Api.Data;

// Для `dotnet ef migrations add`: модель строится без запуска приложения и без живой БД.
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var dataSource = AppDbContext.BuildDataSource("Host=localhost;Database=robo_design");
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(dataSource).Options;
        return new AppDbContext(options);
    }
}
