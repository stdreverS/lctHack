namespace Robo.Api.Data;

/// <summary>
/// Папки backend/config (типы объектов, нормативы) и backend/seed (начальные данные).
/// Переопределяются Robo:ConfigDir и Robo:SeedDir (Robo__ConfigDir, Robo__SeedDir); по умолчанию —
/// копии рядом со сборкой (config/, seed/), их кладут туда сборка и dotnet publish.
/// </summary>
public static class RoboPaths
{
    public static string ConfigDir(IConfiguration configuration) => Resolve(configuration, "Robo:ConfigDir", "config");

    public static string SeedDir(IConfiguration configuration) => Resolve(configuration, "Robo:SeedDir", "seed");

    private static string Resolve(IConfiguration configuration, string key, string folder)
    {
        var dir = configuration[key];
        if (string.IsNullOrWhiteSpace(dir))
            dir = Path.Combine(AppContext.BaseDirectory, folder);
        if (!Directory.Exists(dir))
            throw new DirectoryNotFoundException($"Папка {dir} не найдена. Укажите путь в {key}");
        return Path.GetFullPath(dir);
    }
}
