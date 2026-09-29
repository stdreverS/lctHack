using System.Globalization;

namespace Robo.Core.Internal;

/// <summary>
/// Арифметика и форматирование как в JavaScript-модели мока (frontend/src/mocks/data): расчёт
/// идёт в double в том же порядке операций, округление — по правилам Math.round, чтобы числа
/// ядра совпадали с моком до последнего знака (проверяет GoldenCalculationTests).
/// </summary>
internal static class Js
{
    private static readonly NumberFormatInfo Ru = new()
    {
        NumberGroupSeparator = " ",   // неразрывный пробел, как formatNumber во фронтенде
        NumberDecimalSeparator = ",",
        NegativeSign = "-",
    };

    /// <summary>Math.round: к ближайшему целому, половина — вверх (к +∞), −2,5 → −2.</summary>
    public static double Round(double x)
    {
        var floor = Math.Floor(x);
        return x - floor >= 0.5 ? floor + 1 : floor;
    }

    /// <summary>formatNumber из utils/format.ts: до 2 знаков после запятой, «1 234 567,89».</summary>
    public static string FormatNumber(double value)
    {
        var rounded = Round(value * 100) / 100;
        if (rounded == 0 || double.IsNaN(rounded)) rounded = 0;   // без «-0»
        return rounded.ToString("#,##0.##", Ru);
    }

    /// <summary>Число из шаблонной строки JS: `${n}`.</summary>
    public static string Plain(double value) => value.ToString(CultureInfo.InvariantCulture);

    /// <summary>double → decimal для ответа; −0 становится 0.</summary>
    public static decimal Dec(double value) => value == 0 ? 0m : (decimal)value;

    public static decimal? Dec(double? value) => value is { } v ? Dec(v) : null;
}
