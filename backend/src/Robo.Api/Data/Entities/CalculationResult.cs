using System.ComponentModel.DataAnnotations.Schema;


namespace Robo.Api.Data.Entities;

public class CalculationResult
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;

    [Column(TypeName = "jsonb")]
    public string InputsJson { get; set; } = string.Empty;
    [Column(TypeName = "jsonb")]
    public string ResultsJson { get; set; } = string.Empty;

    public string ModelVersion { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

