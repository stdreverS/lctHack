# Развёртывание

## Схема

```
браузер ──► web :8080 (nginx: статика фронтенда, /api/ → api:8080) ──► api (Robo.Api + Robo.Core) ──► db (PostgreSQL 17)
                                                                          │
                                                                          ├── /app/config — типы объектов, нормативы (backend/config)
                                                                          └── /app/seed — демо-каталог и демо-учётки (backend/seed)
```

| Сервис | Образ | Что делает |
|---|---|---|
| `web` | `frontend/Dockerfile`: `node:24-alpine` (сборка) → `nginx:stable-alpine` | Отдаёт фронтенд, проксирует `/api/` в `api`. Собирается с `VITE_USE_MOCKS=false` |
| `api` | `backend/Dockerfile`: `dotnet/sdk:10.0` (сборка) → `dotnet/aspnet:10.0` | API на порту 8080 внутри сети compose. При старте применяет миграции и заливает seed в пустые таблицы |
| `db` | `postgres:17-alpine` | База данных, том `pgdata`. `api` стартует только после `pg_isready` |

Наружу открыт только порт 8080 (`web`). API и база доступны лишь внутри сети compose.

## Требования

| Для чего | Что нужно |
|---|---|
| Запуск в Docker | Docker 24+ с Compose v2, свободный порт 8080; при первой сборке — доступ к Docker Hub, `mcr.microsoft.com`, `registry.npmjs.org` и `api.nuget.org` |
| Локальная разработка фронтенда | Node.js 22.18+ или 24.12+ |
| Локальный запуск и тесты бэкенда | .NET SDK 10 **и рантайм ASP.NET Core 10** (`dotnet --list-runtimes` → `Microsoft.AspNetCore.App 10.x`), PostgreSQL |
| Клиент | Современный браузер, экран от 1366×768 |

После сборки образов интернет не нужен: шрифты и библиотеки входят в сборку.

## Переменные окружения

`.env` в корне (образец — `.env.example`; `.env` в `.gitignore`, не коммитьте его):

| Переменная | Обязательна | Смысл |
|---|---|---|
| `POSTGRES_PASSWORD` | да | Пароль PostgreSQL (для `db` и строки подключения `api`) |
| `JWT_SECRET` | да | Ключ подписи токенов, не короче 32 символов |
| `POSTGRES_DB`, `POSTGRES_USER` | нет (`robo`) | Имя базы и пользователя |

Без обязательных переменных `docker compose` не запустится и назовёт недостающую.

Переменные `api` (задаются в `docker-compose.yml`; при запуске без Docker — в
`appsettings.Development.json` или окружении):

| Переменная | Значение в compose | Смысл |
|---|---|---|
| `ConnectionStrings__Default` | `Host=db;…` из `.env` | Строка подключения PostgreSQL |
| `Jwt__Secret` | `JWT_SECRET` | Ключ подписи токенов |
| `Robo__ConfigDir` | `/app/config` (смонтирована `backend/config`) | Папка `object-types.json` и `norms.json`; правка нормативов без пересборки — `docker compose restart api` |
| `Robo__SeedDir` | `/app/seed` (из образа) | Папка `robots.json` и `users.json` |

Сборка фронтенда: `VITE_USE_MOCKS` — `false` (запросы идут на `/api/v1`) или `true` (моки в
браузере, сервер не нужен). Переменная окружения важнее файлов `frontend/.env.*`.

## Запуск

```bash
cp .env.example .env            # задайте свои пароль БД и JWT_SECRET
docker compose up -d --build    # сборка и запуск трёх контейнеров
docker compose ps               # web — healthy, api и db — running (db — healthy)
docker compose logs -f api      # миграции, «Seed: добавлено роботов — 10»
docker compose down             # остановка; данные остаются в томе pgdata
docker compose down -v          # остановка с удалением базы
```

Приложение: <http://localhost:8080>. Проверка после запуска — `docs/manual-test.md`, раздел 8.

Демо-учётки: `user@demo.ru` / `Demo12345`, `admin@demo.ru` / `Admin12345` (создаются при первом
запуске из `backend/seed/users.json`, пароли хранятся хэшами BCrypt). Проектов на сервере
сначала нет: демо-проекты есть только в автономном демо на моках.

### Автономное демо на моках

Без сервера и базы — один контейнер, данные в браузере пользователя:

```bash
docker build --build-arg VITE_USE_MOCKS=true -t robo-platform-web:demo frontend
docker run -d -p 8080:80 robo-platform-web:demo
```

### Если сервер недоступен

Если `api` ещё запускается, упал или его нет, nginx отвечает на `/api/` кодом 502. Фронтенд
показывает «Нет связи с сервером» с советом повторить — страницы не пустеют. Ошибки
отрисовки и не загрузившиеся модули страниц показываются экраном «На странице произошла
ошибка» / «Не удалось загрузить страницу» с кнопками «Обновить страницу» и «На главную».

### Если сборка падает на `npm ci` или `dotnet restore`

Симптом: сборка в контейнере висит или падает с `ECONNRESET` при скачивании пакетов, хотя на
хосте всё работает. Причина — сеть Docker (мост) до реестра пакетов недоступна или
нестабильна (VPN, прокси, MTU). Соберите образы в сети хоста и запустите без пересборки:

```bash
docker build --network host -t robo-platform-web frontend
docker build --network host -t robo-platform-api backend
docker compose up -d --no-build
```

## Локальная разработка

```bash
# Бэкенд: PostgreSQL на localhost:5432 (postgres/postgres — appsettings.Development.json)
cd backend && dotnet run --project src/Robo.Api --launch-profile http   # http://localhost:5203, Swagger — /swagger

# Фронтенд против бэкенда: Vite проксирует /api на :5203
cd frontend && VITE_USE_MOCKS=false npm run dev

# Фронтенд на моках (по умолчанию для npm run dev)
cd frontend && npm run dev
```

## Ограничения

- HTTPS не настроен: `web` отдаёт HTTP на порту 8080; для размещения в сети нужен TLS на nginx
  или внешнем прокси (п. 4.4.4 ТЗ).
- У `api` нет healthcheck: в образе `aspnet` нет `curl`/`wget`. `web` ждёт только запуска
  контейнера `api`; пока API применяет миграции, фронтенд показывает «Нет связи с сервером».
- Демо-учётки с известными паролями создаются и в этом развёртывании; для продуктивной работы
  замените `backend/seed/users.json`.
- Резервное копирование тома `pgdata` не настроено.
- PDF на сервере не формируется (501); отчёт для печати и PDF делает фронтенд.
