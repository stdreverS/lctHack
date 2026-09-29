using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql;
using Robo.Api.Contracts;
using Robo.Api.Data.Entities;
using Robo.Core.Contracts;

namespace Robo.Api.Data;

public class AppDbContext : DbContext
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Robot> Robots => Set<Robot>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<CalculationResult> CalculationResults => Set<CalculationResult>();

    /// <summary>
    /// Источник подключений Npgsql. Сложные поля (specs, params, assumptions, запрос и результат
    /// расчёта) лежат в jsonb и сериализуются System.Text.Json в camelCase — как в API.
    /// </summary>
    public static NpgsqlDataSource BuildDataSource(string connectionString)
    {
        var builder = new NpgsqlDataSourceBuilder(connectionString);
        builder.EnableDynamicJson();
        builder.ConfigureJsonOptions(JsonOptions);
        return builder.Build();
    }

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(e =>
        {
            e.ToTable("users");
            e.Property(u => u.Email).IsRequired();
            e.HasIndex(u => u.Email).IsUnique();
        });

        model.Entity<Robot>(e =>
        {
            e.ToTable("robots");
            e.Property(r => r.Specs).HasColumnType("jsonb");
            e.HasIndex(r => r.SolutionType);
        });

        model.Entity<Project>(e =>
        {
            e.ToTable("projects");
            e.Property(p => p.Params).HasColumnType("jsonb");
            e.Property(p => p.Assumptions).HasColumnType("jsonb");
            e.HasOne<User>().WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => new { p.UserId, p.UpdatedAt });
        });

        model.Entity<CalculationResult>(e =>
        {
            e.ToTable("calculations");
            e.Property(c => c.Inputs).HasColumnType("jsonb");
            e.Property(c => c.Results).HasColumnType("jsonb");
            e.HasOne<Project>().WithMany().HasForeignKey(c => c.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(c => new { c.ProjectId, c.CreatedAt });
        });

        if (!Database.IsNpgsql())
            UseJsonStringsForJsonb(model);

        // Колонки в snake_case: password_hash, created_at, ...
        foreach (var entity in model.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties())
                property.SetColumnName(ToSnakeCase(property.Name));
    }

    // Для других провайдеров (InMemory в тестах API): поля jsonb хранятся строкой JSON.
    private static void UseJsonStringsForJsonb(ModelBuilder model)
    {
        model.Entity<Robot>().Property(r => r.Specs).HasConversion(JsonConverter<RobotSpecs>());
        model.Entity<Project>().Property(p => p.Params).HasConversion(JsonConverter<Dictionary<string, JsonElement>>());
        model.Entity<Project>().Property(p => p.Assumptions).HasConversion(JsonConverter<Assumptions>());
        model.Entity<CalculationResult>().Property(c => c.Inputs).HasConversion(JsonConverter<CalcRequest>());
        model.Entity<CalculationResult>().Property(c => c.Results).HasConversion(JsonConverter<CalcResult>());
    }

    private static ValueConverter<T, string> JsonConverter<T>() => new(
        v => JsonSerializer.Serialize(v, JsonOptions),
        v => JsonSerializer.Deserialize<T>(v, JsonOptions)!);

    private static string ToSnakeCase(string name)
    {
        var sb = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            if (char.IsUpper(name[i]) && i > 0) sb.Append('_');
            sb.Append(char.ToLowerInvariant(name[i]));
        }
        return sb.ToString();
    }
}
