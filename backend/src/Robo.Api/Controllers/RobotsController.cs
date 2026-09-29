using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Robo.Api.Contracts;
using Robo.Api.Data;
using Robo.Api.Data.Entities;
using Robo.Api.Errors;
using Robo.Core.Contracts;

namespace Robo.Api.Controllers;

[ApiController]
[Route("/api/v1/robots")]
public class RobotsController : ControllerBase
{
    private static readonly CompareInfo RuCompare = RussianCompareInfo();

    // Ключи сортировки из specs (числовые характеристики)
    private static readonly Dictionary<string, Func<RobotSpecs, double?>> SpecKeys = new()
    {
        ["payloadKg"] = s => s.PayloadKg,
        ["speedMps"] = s => s.SpeedMps,
        ["perfOpsPerHour"] = s => s.PerfOpsPerHour,
        ["autonomyH"] = s => s.AutonomyH,
        ["chargeTimeH"] = s => s.ChargeTimeH,
        ["positioningMm"] = s => s.PositioningMm,
        ["minAisleM"] = s => s.MinAisleM,
        ["widthM"] = s => s.WidthM,
        ["lengthM"] = s => s.LengthM,
        ["heightM"] = s => s.HeightM,
        ["lifeYears"] = s => s.LifeYears,
    };

    private readonly AppDbContext _db;
    private readonly EngineConfig _config;

    public RobotsController(AppDbContext db, EngineConfig config)
    {
        _db = db;
        _config = config;
    }

    /// <summary>
    /// Каталог с фильтрами. Каталог небольшой, поэтому поиск и сортировка — в памяти, по тем же
    /// правилам, что в моке: q — подстрока в названии или производителе без учёта регистра;
    /// sort — name, price или ключ specs, «-» — по убыванию, null меньше любого числа.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllRobots(
        [FromQuery] string? objectType, [FromQuery] string? solutionType,
        [FromQuery] string? q, [FromQuery] string? sort)
    {
        var query = _db.Robots.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(objectType))
            query = query.Where(r => r.ObjectTypes.Contains(objectType));
        if (!string.IsNullOrWhiteSpace(solutionType))
            query = query.Where(r => r.SolutionType == solutionType);

        IEnumerable<Robot> robots = await query.OrderBy(r => r.Id).ToListAsync();

        var text = q?.Trim();
        if (!string.IsNullOrEmpty(text))
            robots = robots.Where(r =>
                r.Name.Contains(text, StringComparison.OrdinalIgnoreCase) ||
                r.Manufacturer.Contains(text, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(sort))
            robots = Sort(robots, sort.Trim());

        return Ok(robots.ToList());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRobot(string id)
    {
        var robot = await _db.Robots.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
        return robot == null ? ApiResults.NotFound("Робот") : Ok(robot);
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> CreateRobot([FromBody] CreateRobotRequest request)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return ApiResults.Invalid(errors);

        var robot = new Robot { Id = Guid.NewGuid().ToString() };
        Apply(robot, request);
        _db.Robots.Add(robot);
        await _db.SaveChangesAsync();
        return StatusCode(201, robot);
    }

    [Authorize(Roles = "admin")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRobot(string id, [FromBody] CreateRobotRequest request)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return ApiResults.Invalid(errors);

        var robot = await _db.Robots.FirstOrDefaultAsync(r => r.Id == id);
        if (robot == null) return ApiResults.NotFound("Робот");

        Apply(robot, request);
        await _db.SaveChangesAsync();
        return Ok(robot);
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRobot(string id)
    {
        var robot = await _db.Robots.FirstOrDefaultAsync(r => r.Id == id);
        if (robot == null) return ApiResults.NotFound("Робот");

        _db.Robots.Remove(robot);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static IEnumerable<Robot> Sort(IEnumerable<Robot> robots, string sort)
    {
        var desc = sort.StartsWith('-');
        var key = desc ? sort[1..] : sort;

        if (key == "name")
        {
            var byName = Comparer<string>.Create((a, b) => RuCompare.Compare(a, b));
            return desc ? robots.OrderByDescending(r => r.Name, byName) : robots.OrderBy(r => r.Name, byName);
        }

        Func<Robot, double> value = key == "price"
            ? r => (double)r.Price
            : SpecKeys.TryGetValue(key, out var spec)
                ? r => spec(r.Specs) ?? double.NegativeInfinity
                : _ => 0;   // неизвестный ключ — порядок не меняется, как в моке
        return desc ? robots.OrderByDescending(value) : robots.OrderBy(value);
    }

    // В контейнере с InvariantGlobalization культуры ru-RU нет — тогда порядок по коду символов.
    private static CompareInfo RussianCompareInfo()
    {
        try { return CultureInfo.GetCultureInfo("ru-RU").CompareInfo; }
        catch (CultureNotFoundException) { return CultureInfo.InvariantCulture.CompareInfo; }
    }

    private List<ErrorDetail> Validate(CreateRobotRequest r)
    {
        var errors = new List<ErrorDetail>();
        if (string.IsNullOrWhiteSpace(r.Name))
            errors.Add(new ErrorDetail { Field = "name", Message = "Укажите название робота" });
        if (string.IsNullOrWhiteSpace(r.Manufacturer))
            errors.Add(new ErrorDetail { Field = "manufacturer", Message = "Укажите производителя" });
        if (r.Price is not > 0)
            errors.Add(new ErrorDetail { Field = "price", Message = "Цена должна быть больше нуля", Hint = "Цена в рублях с НДС, например 4200000" });
        if (string.IsNullOrWhiteSpace(r.SolutionType))
            errors.Add(new ErrorDetail { Field = "solutionType", Message = "Укажите тип решения", Hint = "Код латиницей, например amr" });
        if (r.MaintenancePerYear is not >= 0)
            errors.Add(new ErrorDetail { Field = "maintenancePerYear", Message = "Стоимость обслуживания не может быть отрицательной" });
        var types = r.ObjectTypes ?? [];
        if (types.Count == 0 || types.Any(code => _config.ObjectTypes.All(t => t.Code != code)))
            errors.Add(new ErrorDetail { Field = "objectTypes", Message = "Выберите типы объектов из списка", Hint = "Хотя бы один тип, например «Склад»" });
        return errors;
    }

    // Вызывается после Validate: обязательные поля заполнены.
    private static void Apply(Robot robot, CreateRobotRequest r)
    {
        robot.Name = r.Name!.Trim();
        robot.Manufacturer = r.Manufacturer!.Trim();
        robot.SolutionType = r.SolutionType!.Trim();
        robot.SolutionTypeName = r.SolutionTypeName?.Trim() ?? "";
        robot.ObjectTypes = r.ObjectTypes!;
        robot.Country = r.Country;
        robot.Availability = r.Availability;
        robot.Price = r.Price!.Value;
        robot.RaasMonthlyPrice = r.RaasMonthlyPrice;
        robot.MaintenancePerYear = r.MaintenancePerYear!.Value;
        robot.Specs = r.Specs ?? new RobotSpecs();
        robot.SourceUrl = r.SourceUrl;
        robot.SourceDate = r.SourceDate;
        robot.Confirmed = r.Confirmed;
    }
}
