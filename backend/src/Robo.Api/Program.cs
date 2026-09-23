using Microsoft.EntityFrameworkCore;
using Robo.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var connectionString = "Host=localhost;Port=5432;Database=RoboDb;Username=postgres;Password=postgres";
builder.Services.AddDbContext<AppDbContext>(optoins =>
    optoins.UseNpgsql(connectionString)
);

var app = builder.Build();

app.MapControllers();
app.Run();