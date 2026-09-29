# Robo.Api (ASP.NET Core + Robo.Core). Контекст сборки — папка backend/.
# Справочники (config/) и начальные данные (seed/) попадают в образ через dotnet publish
# (см. Robo.Api.csproj) — в /app/config и /app/seed. При старте API применяет миграции и seed.

# ---------- Сборка ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Сначала только проекты — слой restore кэшируется, пока не меняются зависимости
COPY src/Robo.Core/Robo.Core.csproj src/Robo.Core/
COPY src/Robo.Api/Robo.Api.csproj src/Robo.Api/
RUN dotnet restore src/Robo.Api/Robo.Api.csproj

COPY src/ src/
COPY config/ config/
COPY seed/ seed/
RUN dotnet publish src/Robo.Api/Robo.Api.csproj -c Release -o /app --no-restore

# ---------- Запуск ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080 \
    Robo__ConfigDir=/app/config \
    Robo__SeedDir=/app/seed
EXPOSE 8080

# Непривилегированный пользователь из базового образа
USER $APP_UID
ENTRYPOINT ["dotnet", "Robo.Api.dll"]
