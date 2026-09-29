namespace Robo.Core;

/// <summary>
/// Расчёт невозможен по данным (API отвечает 422 CALCULATION_ERROR). Message — готовая фраза
/// на русском: что не так и как исправить.
/// </summary>
public sealed class CalculationException(string message) : Exception(message);
