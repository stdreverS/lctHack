namespace Robo.Api.Mapping;

public static class ApiTime
{
    /// <summary>
    /// Текущее время UTC с точностью до миллисекунд: в JSON — «2026-09-22T11:26:28.222Z», и после
    /// сохранения в PostgreSQL (точность — микросекунды) значение не меняется.
    /// </summary>
    public static DateTime Now()
    {
        var now = DateTime.UtcNow;
        return new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
    }
}
