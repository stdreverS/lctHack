using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Robo.Api.Data;
using Robo.Api.Data.Entities;
using Robo.Core;
using Robo.Core.Contracts;
using Robo.Core.Config;
using Robo.Api.Contracts;
using Microsoft.AspNetCore.Authorization;
using ClosedXML.Excel;
using System.IO;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QuestPDF.Fluent;

namespace Robo.Api.Controllers;

[ApiController]
[Route("api/v1/calculations")]
public class CalculationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public CalculationsController(AppDbContext db)
    {
        _db = db;
    }


    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetProjectCalculations(string projectId)
    {
        var userId = User.FindFirst("userId")?.Value;
        var project = await _db.Projects.FirstOrDefaultAsync(r => r.Id == projectId && r.UserId == userId);

        if (project == null)
        {
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Проект не найден",
                Errors = new()
            });
        }

        var calculations = await _db.CalculationResults.Where(r => r.ProjectId == projectId).OrderByDescending(r => r.CreatedAt).ToListAsync();
        var summary = calculations.Select(r =>
        {
            var res = JsonSerializer.Deserialize<CalcResult>(r.ResultsJson);
            return new
            {
                Id = r.Id,
                CreateAt = r.CreatedAt,
                ModelVersion = r.ModelVersion,
                DataVersion = "catalog-2026.09"
            };
        });
        return Ok(summary);
    }



    [HttpPost]
    public async Task<IActionResult> Calculate([FromBody] CalcRequest request)
    {
        var dbRobots = await _db.Robots.ToListAsync();

        var robotSpecs = dbRobots.Select(r => new RobotSpec
        {
            Id = r.Id,
            Name = r.Name,
            SolutionType = r.SolutionType,
            ObjectTypes = r.ObjectTypes,
            Confirmed = r.Confirmed,
            Price = r.Price ?? 0m,
            RaasMonthlyPrice = r.RaasMonthlyPrice,
            MaintenancePerYear = r.MaintenancePerYear ?? 0m,
            PayloadKg = r.Specs?.PayloadKg,
            SpeedMps = r.Specs?.SpeedMps,
            PerfOpsPerHour = r.Specs?.PerfOpsPerHour,
            AutonomyH = r.Specs?.AutonomyH,
            ChargeTimeH = r.Specs?.ChargeTimeH,
            PositioningMm = r.Specs?.PositioningMm,
            Navigation = r.Specs?.Navigation,
            MinAisleM = r.Specs?.MinAisleM,
            WidthM = r.Specs?.WidthM,
            LengthM = r.Specs?.LengthM,
            HeightM = r.Specs?.HeightM,
            LifeYears = r.Specs?.LifeYears
        }).ToList();


        if (request.Scenarios != null)
        {
            for (int i = 0; i < request.Scenarios.Count; i++)
            {
                var scenario = request.Scenarios[i];
                if (scenario.Kind == "purchase" || scenario.Kind == "raas")
                {
                    var robot = robotSpecs.FirstOrDefault(r => r.Id == scenario.RobotId);
                    if (string.IsNullOrEmpty(scenario.RobotId) || robot == null)
                        return BadRequest(new ErrorResponse
                        {
                            Status = 400,
                            Code = "VALIDATION_ERROR",
                            Title = "Проверьте введеные данные",
                            Errors = new List<ErrorDetail>
                            {
                                new ErrorDetail
                                {
                                    Field = $"scenario[{i}].robotId",
                                    Message = "Выберите робота для сценария"
                                }
                            }
                        });
                    if (robot.PerfOpsPerHour == null && (scenario.Overrides == null || scenario.Overrides.RobotCount == null))
                    {
                        return UnprocessableEntity(new ErrorResponse
                        {
                            Status = 422,
                            Code = "CALCULATION_ERROR",
                            Title = $"Проверьте данные",
                            Errors = new List<ErrorDetail>
                            {
                                new ErrorDetail
                                {
                                    Field = $"robot.Name",
                                    Message = $"Для {robot.Name} не указана производительность",
                                    Hint = "Задайте число роботов вручную"
                                }
                            }
                        });
                    }
                    if (scenario.Kind == "raas" && robot.RaasMonthlyPrice == null && (scenario.Overrides == null || scenario.Overrides.MaintenancePerYearRub == null))
                    {
                        return UnprocessableEntity(new ErrorResponse
                        {
                            Status = 422,
                            Code = "CALCULATION_ERROR",
                            Title = $"Проверьте данные",
                            Errors = new List<ErrorDetail>
                            {
                                new ErrorDetail
                                {
                                    Field = $"robot.Name",
                                    Message = $"Для {robot.Name} нет цены аренды",
                                    Hint = "Укажите ежемесячную плату за робота"
                                }
                            }
                        });
                    }
                }
            }
        }


        var objTypes = new List<ObjectTypeConfig>();
        var config = new EngineConfig(
            ObjectTypes: objTypes.AsReadOnly(),
            Norms: null!
        );

        CalcResult result = CalculationEngine.Calculate(request, robotSpecs, config);

        bool hasToken = User.Identity?.IsAuthenticated == true;

        if (hasToken && !string.IsNullOrEmpty(request.ProjectId))
        {
            var userId = User.FindFirst("userId")?.Value;
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.UserId == userId);

            if (project == null)
            {
                return NotFound(new ErrorResponse
                {
                    Status = 404,
                    Code = "NOT_FOUND",
                    Title = "Проект не найден",
                    Errors = new()
                });
            }

            var newCalcId = Guid.NewGuid().ToString();

            var resultWithId = result with { CalculationId = newCalcId };

            var historyRecord = new Data.Entities.CalculationResult
            {
                Id = newCalcId,
                ProjectId = project.Id,
                InputsJson = JsonSerializer.Serialize(request),
                ResultsJson = JsonSerializer.Serialize(resultWithId),
                ModelVersion = resultWithId.ModelVersion,
                CreatedAt = DateTime.UtcNow
            };

            _db.CalculationResults.Add(historyRecord);
            project.UpdatedAt = DateTime.UtcNow.ToString();

            await _db.SaveChangesAsync();

            return Ok(resultWithId);
        }

        return Ok(result);
    }


    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetCalculationRecord(string id)
    {
        var userId = User.FindFirst("userId")?.Value;

        var calc = await _db.CalculationResults.FirstOrDefaultAsync(c => c.Id == id);

        if (calc == null || !await _db.Projects.AnyAsync(p => p.Id == calc.ProjectId && p.UserId == userId))
        {
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Расчёт не найден — возможно, он был удалён",
                Errors = new()
            });
        }

        var response = new
        {
            id = calc.Id,
            createdAt = calc.CreatedAt,
            request = JsonSerializer.Deserialize<JsonElement>(calc.InputsJson),
            result = JsonSerializer.Deserialize<JsonElement>(calc.ResultsJson)
        };

        return Ok(response);
    }

    [Authorize]
    [HttpGet("{id}/report.pdf")]
    public async Task<IActionResult> DownloadPdf(string id)
    {
        var userId = User.FindFirst("userId")?.Value;
        var calc = await _db.CalculationResults.FirstOrDefaultAsync(c => c.Id == id);

        if (calc == null || !await _db.Projects.AnyAsync(p => p.Id == calc.ProjectId && p.UserId == userId))
        {
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Расчёт не найден — возможно, он был удалён",
                Errors = new()
            });
        }

        QuestPDF.Settings.License = LicenseType.Community;

        var requestData = JsonDocument.Parse(calc.InputsJson);
        string objType = requestData.RootElement.TryGetProperty("objectType", out var ot) ? ot.GetString() ?? "-" : "-";

        byte[] fileBytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(12));

                page.Header().Text("Отчет по роботизации (ФЦ БАС)").SemiBold().FontSize(18).FontColor(Colors.Blue.Darken2);

                page.Content().PaddingVertical(1, Unit.Centimetre).Column(x =>
                {
                    x.Spacing(10);
                    x.Item().Text($"ID расчёта: {calc.Id}");
                    x.Item().Text($"Дата: {calc.CreatedAt:dd.MM.yyyy HH:mm}");
                    x.Item().Text($"Тип объекта: {objType}");

                    x.Item().PaddingTop(20).Text("Детальные результаты расчетов загружены из базы.").Italic().FontColor(Colors.Grey.Medium);
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("Страница ");
                    x.CurrentPageNumber();
                    x.Span(" из ");
                    x.TotalPages();
                });
            });
        }).GeneratePdf();

        return File(fileBytes, "application/pdf", $"report-{id}.pdf");
    }

    [Authorize]
    [HttpGet("{id}/export.xlsx")]
    public async Task<IActionResult> DownloadExcel(string id)
    {
        var userId = User.FindFirst("userId")?.Value;
        var calc = await _db.CalculationResults.FirstOrDefaultAsync(c => c.Id == id);

        if (calc == null || !await _db.Projects.AnyAsync(p => p.Id == calc.ProjectId && p.UserId == userId))
        {
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Расчёт не найден — возможно, он был удалён",
                Errors = new()
            });
        }


        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Отчет");

        ws.Cell(1, 1).Value = "ID Расчета";
        ws.Cell(1, 2).Value = "Дата создания";
        ws.Cell(1, 3).Value = "Тип объекта";
        ws.Range("A1:C1").Style.Font.Bold = true;

        var requestData = JsonDocument.Parse(calc.InputsJson);
        string objType = requestData.RootElement.TryGetProperty("objectType", out var ot) ? ot.GetString() ?? "" : "";

        ws.Cell(2, 1).Value = calc.Id;
        ws.Cell(2, 2).Value = calc.CreatedAt.ToString("dd.MM.yyyy HH:mm");
        ws.Cell(2, 3).Value = objType;

        ws.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        byte[] fileBytes = stream.ToArray();

        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"export-{id}.xlsx");
    }
}