using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Robo.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var connectionString = "Host=localhost;Port=5432;Database=RoboDb;Username=postgres;Password=postgres";
builder.Services.AddDbContext<AppDbContext>(optoins =>
    optoins.UseNpgsql(connectionString)
);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = "RoboApi",
        ValidateAudience = true,
        ValidAudience = "RoboClients",
        ValidateLifetime = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("super-secret-key-for-robo-platform-hackathon-must-be-long")),
        ValidateIssuerSigningKey = true
    };
});
builder.Services.AddAuthentication();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();