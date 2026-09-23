using Robo.Api.Data;
using Robo.Api.Contracts;
using System.Collections.Generic;

namespace Robo.Api.Data.Entities;

public class Project
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> ObjectType { get; set; } = new();
    public ProjectParams Params { get; set; } = new();
    public ProjectAssumptions Assumptions { get; set; } = new();
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}