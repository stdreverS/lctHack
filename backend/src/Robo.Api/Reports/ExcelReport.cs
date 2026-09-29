using System.Text.Json;
using ClosedXML.Excel;
using Robo.Api.Data.Entities;
using Robo.Core.Contracts;

namespace Robo.Api.Reports;

/// <summary>
/// Выгрузка сохранённого расчёта в Excel: сводка показателей по сценариям, оборудование,
/// денежный поток, подбор, чувствительность, допущения и параметры объекта.
/// Числа пишутся числами (формат ячейки), чтобы с ними можно было считать дальше.
/// </summary>
public static class ExcelReport
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private const string Rub = "#,##0 \"₽\"";
    private const string Num = "#,##0.##";

    private static readonly Dictionary<string, string> StatusLabels = new()
    {
        ["recommended"] = "Подходит",
        ["needs_check"] = "Требует проверки",
        ["excluded"] = "Не подходит",
    };

    public static byte[] Build(CalculationResult calc, EngineConfig config)
    {
        var request = calc.Inputs;
        var result = calc.Results;
        var objectType = config.ObjectTypes.FirstOrDefault(t => t.Code == request.ObjectType);

        using var workbook = new XLWorkbook();
        Summary(workbook.AddWorksheet("Сводка"), calc, objectType?.Name ?? request.ObjectType);
        Equipment(workbook.AddWorksheet("Оборудование"), result);
        Cashflow(workbook.AddWorksheet("Денежный поток"), result);
        Recommendation(workbook.AddWorksheet("Подбор"), result);
        Sensitivity(workbook.AddWorksheet("Чувствительность"), result);
        Assumptions(workbook.AddWorksheet("Допущения"), result);
        Params(workbook.AddWorksheet("Параметры"), request, objectType?.Fields ?? []);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void Summary(IXLWorksheet ws, CalculationResult calc, string objectTypeName)
    {
        var result = calc.Results;
        var info = new (string, object)[]
        {
            ("Расчёт", calc.Id),
            ("Дата расчёта (UTC)", calc.CreatedAt),
            ("Тип объекта", objectTypeName),
            ("Версия модели", result.ModelVersion),
            ("Версия данных", result.DataVersion),
        };
        var row = 1;
        foreach (var (label, value) in info)
        {
            ws.Cell(row, 1).Value = label;
            ws.Cell(row, 2).Value = XLCellValue.FromObject(value);
            row++;
        }
        ws.Cell(2, 2).Style.DateFormat.Format = "dd.MM.yyyy HH:mm";
        ws.Range(1, 1, row - 1, 1).Style.Font.Bold = true;
        ws.Cell(row, 1).Value = result.Disclaimer;
        ws.Cell(row, 1).Style.Font.Italic = true;
        row += 2;

        // Показатели: строки — метрики, столбцы — сценарии
        var header = row;
        ws.Cell(header, 1).Value = "Показатель";
        for (var i = 0; i < result.Scenarios.Count; i++)
            ws.Cell(header, i + 2).Value = result.Scenarios[i].Title;
        ws.Cell(header, result.Scenarios.Count + 2).Value = "Единица";
        ws.Cell(header, result.Scenarios.Count + 3).Value = "Формула";
        ws.Row(header).Style.Font.Bold = true;

        var metrics = result.Scenarios.Select(s => Metrics(s.Metrics)).ToList();
        var metricCount = metrics.FirstOrDefault()?.Length ?? 0;
        for (var m = 0; m < metricCount; m++)
        {
            var r = header + 1 + m;
            var first = metrics[0][m];
            ws.Cell(r, 1).Value = first.Label;
            for (var s = 0; s < metrics.Count; s++)
            {
                var cell = ws.Cell(r, s + 2);
                cell.Value = metrics[s][m].Value is { } v ? v : "—";
                cell.Style.NumberFormat.Format = first.Unit == "₽" ? Rub : Num;
            }
            ws.Cell(r, metrics.Count + 2).Value = first.Unit;
            ws.Cell(r, metrics.Count + 3).Value = first.Formula;
        }

        var verdictRow = header + 1 + metricCount;
        ws.Cell(verdictRow, 1).Value = "Вывод";
        ws.Cell(verdictRow, 1).Style.Font.Bold = true;
        for (var s = 0; s < result.Scenarios.Count; s++)
            ws.Cell(verdictRow, s + 2).Value = result.Scenarios[s].Verdict.Label;

        ws.Column(1).Width = 34;
        for (var c = 2; c <= result.Scenarios.Count + 1; c++) ws.Column(c).Width = 24;
        ws.Column(result.Scenarios.Count + 3).Width = 60;
    }

    private static Metric[] Metrics(ScenarioMetrics m) =>
        [m.RobotCount, m.CapexRub, m.OpexAnnualRub, m.OpexDeltaRub, m.AnnualEffectRub, m.PaybackYears, m.RoiPercent, m.TcoRub];

    private static void Equipment(IXLWorksheet ws, CalcResult result)
    {
        var rows = result.Scenarios.SelectMany(s => s.Equipment.Select(e =>
            new object?[] { s.Title, e.Item, e.Qty, e.UnitPriceRub, e.TotalRub }));
        Table(ws, ["Сценарий", "Позиция", "Кол-во", "Цена за единицу, ₽", "Сумма, ₽"], rows, [null, null, Num, Rub, Rub]);
    }

    private static void Cashflow(IXLWorksheet ws, CalcResult result)
    {
        var rows = result.Scenarios.SelectMany(s => s.Cashflow.Select(y =>
            new object?[] { s.Title, y.Year, y.CapexRub, y.OpexRub, y.EffectRub, y.CumulativeRub }));
        Table(ws, ["Сценарий", "Год", "CAPEX, ₽", "OPEX, ₽", "Эффект, ₽", "Накопленный итог, ₽"], rows, [null, null, Rub, Rub, Rub, Rub]);
    }

    private static void Recommendation(IXLWorksheet ws, CalcResult result)
    {
        var rows = result.Recommendation.Select(r => new object?[]
        {
            r.Name, r.SolutionType, StatusLabels.GetValueOrDefault(r.Status, r.Status), r.Score,
            string.Join("; ", r.Checks.Where(c => c.Result != "pass").Select(c => c.Message)),
            string.Join("; ", r.MissingData),
        });
        Table(ws, ["Робот", "Тип решения", "Статус", "Балл", "Замечания проверок", "Недостающие данные"], rows, [null, null, null, Num, null, null]);
    }

    private static void Sensitivity(IXLWorksheet ws, CalcResult result)
    {
        var titles = result.Scenarios.ToDictionary(s => s.Id, s => s.Title);
        var rows = result.Sensitivity.SelectMany(series => series.Points.Select(p => new object?[]
        {
            titles.GetValueOrDefault(series.ScenarioId, series.ScenarioId), series.Label,
            p.Delta, p.PaybackYears, p.RoiPercent, p.AnnualEffectRub,
        }));
        Table(ws, ["Сценарий", "Параметр", "Изменение", "Окупаемость, лет", "ROI, %", "Годовой эффект, ₽"], rows, [null, null, "+0%;-0%;0%", Num, Num, Rub]);
    }

    private static void Assumptions(IXLWorksheet ws, CalcResult result)
    {
        var rows = result.AssumptionsUsed.Select(a => new object?[]
        {
            a.Label, Plain(a.Value), a.Unit, a.Source, a.Confirmed ? "Да" : "Нет — требует подтверждения",
        });
        Table(ws, ["Допущение", "Значение", "Единица", "Источник", "Подтверждено"], rows, [null, Num, null, null, null]);
    }

    private static void Params(IXLWorksheet ws, CalcRequest request, IReadOnlyList<Robo.Core.Config.ParamField> fields)
    {
        var rows = request.Params.Select(p =>
        {
            var field = fields.FirstOrDefault(f => f.Key == p.Key);
            return new object?[] { field?.Label ?? p.Key, Plain(p.Value), field?.Unit };
        });
        Table(ws, ["Параметр", "Значение", "Единица"], rows, [null, Num, null]);
    }

    private static void Table(IXLWorksheet ws, string[] headers, IEnumerable<object?[]> rows, string?[] formats)
    {
        for (var c = 0; c < headers.Length; c++)
            ws.Cell(1, c + 1).Value = headers[c];
        ws.Row(1).Style.Font.Bold = true;

        var r = 2;
        foreach (var row in rows)
        {
            for (var c = 0; c < row.Length; c++)
            {
                var cell = ws.Cell(r, c + 1);
                cell.Value = row[c] is null ? Blank.Value : XLCellValue.FromObject(row[c]);
                if (formats[c] is { } format) cell.Style.NumberFormat.Format = format;
            }
            r++;
        }
        // Ширина задаётся явно: AdjustToContents зависит от шрифтов системы (в контейнере их нет)
        for (var c = 1; c <= headers.Length; c++)
            ws.Column(c).Width = c <= 2 ? 32 : 20;
        ws.SheetView.FreezeRows(1);
    }

    // JsonElement и object из JSON → число, строка, bool или пусто для ячейки
    private static object? Plain(object? value) => value switch
    {
        JsonElement { ValueKind: JsonValueKind.Number } e => e.GetDouble(),
        JsonElement { ValueKind: JsonValueKind.String } e => e.GetString(),
        JsonElement { ValueKind: JsonValueKind.True } => "Да",
        JsonElement { ValueKind: JsonValueKind.False } => "Нет",
        JsonElement => null,
        bool b => b ? "Да" : "Нет",
        _ => value,
    };
}
