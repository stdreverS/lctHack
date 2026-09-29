using System.Text.Json;
using Robo.Api.Data.Entities;

namespace Robo.Api.Data;

/// <summary>
/// Начальные данные: демо-учётки (users.json, пароли — хэши BCrypt) и каталог роботов
/// (robots.json, совпадает с демо-каталогом фронтенда). Таблица заполняется, только если пуста.
/// </summary>
public static class SeedRunner
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static void Run(AppDbContext db, string seedDir, ILogger logger)
    {
        if (!db.Users.Any())
        {
            var users = Read<User>(seedDir, "users.json");
            foreach (var user in users)
            {
                if (!user.PasswordHash.StartsWith("$2"))
                    throw new InvalidDataException($"users.json: у {user.Email} passwordHash не является хэшем BCrypt");
                user.Email = user.Email.Trim().ToLowerInvariant();
                user.CreatedAt = DateTime.UtcNow;
            }
            db.Users.AddRange(users);
            logger.LogInformation("Seed: добавлено пользователей — {Count}", users.Count);
        }

        if (!db.Robots.Any())
        {
            var robots = Read<Robot>(seedDir, "robots.json");
            db.Robots.AddRange(robots);
            logger.LogInformation("Seed: добавлено роботов — {Count}", robots.Count);
        }

        db.SaveChanges();
    }

    private static List<T> Read<T>(string dir, string file)
    {
        var path = Path.Combine(dir, file);
        using var stream = File.OpenRead(path);
        try
        {
            return JsonSerializer.Deserialize<List<T>>(stream, Options)
                ?? throw new InvalidDataException($"Файл начальных данных пуст: {path}");
        }
        catch (JsonException e)
        {
            throw new InvalidDataException($"Ошибка в файле начальных данных {path}: {e.Message}", e);
        }
    }
}
