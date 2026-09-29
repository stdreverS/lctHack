using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Robo.Api.Auth;
using Robo.Api.Data;
using Robo.Api.Errors;
using Robo.Core.Config;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

// ---------- Конфигурация (переменные окружения: ConnectionStrings__Default, Jwt__Secret, Robo__ConfigDir, Robo__SeedDir) ----------
var connectionString = configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Не задана строка подключения ConnectionStrings:Default (ConnectionStrings__Default)");
var jwtSecret = configuration["Jwt:Secret"] ?? "";
var configDir = RoboPaths.ConfigDir(configuration);
var seedDir = RoboPaths.SeedDir(configuration);

builder.Services.AddSingleton(ConfigLoader.Load(configDir));
builder.Services.AddSingleton(new JwtProvider(jwtSecret));

// ---------- БД ----------
var dataSource = AppDbContext.BuildDataSource(connectionString);
builder.Services.AddSingleton(dataSource);
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(dataSource));

// ---------- HTTP ----------
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)))
    .AddApiErrorResponses();

builder.Services.AddCors(options =>
    options.AddPolicy("AllowViteFrontend", policy =>
        policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddOpenApi(options =>
    options.AddDocumentTransformer((document, _, _) =>
    {
        // Кнопка Authorize в Swagger UI: токен из POST /auth/login
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
        };
        document.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", document)] = [] }];
        return Task.CompletedTask;
    }));

// ---------- Авторизация ----------
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;   // claims "userId" и "role" остаются с этими именами
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = JwtProvider.Issuer,
        ValidateAudience = true,
        ValidAudience = JwtProvider.Audience,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = JwtProvider.CreateKey(jwtSecret),
        RoleClaimType = JwtProvider.RoleClaim,
    };
});
builder.Services.AddAuthorization();

var app = builder.Build();

// Миграции и начальные данные — до приёма запросов
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.IsRelational())
        db.Database.Migrate();
    else
        db.Database.EnsureCreated();   // InMemory в тестах API
    SeedRunner.Run(db, seedDir, app.Logger);
}

app.UseApiErrors();

app.MapOpenApi();                              // /openapi/v1.json
app.UseSwaggerUI(options =>                    // /swagger
    options.SwaggerEndpoint("/openapi/v1.json", "Robo API v1"));

app.UseCors("AllowViteFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();

// Для WebApplicationFactory<Program> в тестах
public partial class Program;
