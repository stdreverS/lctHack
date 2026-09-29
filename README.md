# Платформа подбора роботизированных решений

Хакатон ФЦ БАС. Веб-платформа для экспресс-предынвестиционной оценки роботизации объекта:
выбор объекта → параметры → подбор роботов → сравнение → экономика трёх сценариев
(без роботов, покупка, аренда RaaS) → what-if → 2D-симуляция → отчёт и экспорт.
Для руководителей, технических директоров, логистов и аналитиков — без навыков программирования.

Команда: Амир — фронтенд, расчётное ядро, документация; Ермолай — бэкенд API.

## Что реализовано

Три контейнера: фронтенд за nginx, API на ASP.NET Core с расчётным ядром, PostgreSQL.

| Часть | Состояние |
|---|---|
| Фронтенд (Vue 3 + TypeScript) | Весь путь из 8 шагов для гостя и зарегистрированного пользователя, каталог, проекты и история расчётов, админка каталога, печатный отчёт (PDF через печать), CSV, PNG-схема, Excel с сервера |
| API `backend/src/Robo.Api` (.NET 10) | Все эндпоинты контракта ([docs/api.md](docs/api.md)): JWT, роли, изоляция проектов по владельцу, хранение в PostgreSQL (EF Core, миграции, начальные данные), Excel-выгрузка, OpenAPI и Swagger UI |
| Расчётное ядро `backend/src/Robo.Core` | Подбор `rec-1.0` и экономика `econ-1.0`, коэффициенты — `backend/config/norms.json` ([docs/economics.md](docs/economics.md), [docs/recommendation.md](docs/recommendation.md)) |
| Типы объектов | Склад, аэропорт, больница: формы по п. 3.2.1 ТЗ, подбор, экономика. 2D-симуляция — только для склада |
| 2D-симуляция | Дискретно-событийная модель в браузере (`sim-1.2`), см. [docs/simulation.md](docs/simulation.md) |
| Автономное демо | Сборка с `VITE_USE_MOCKS=true` работает без сервера: мок-сервер в браузере с той же моделью расчёта (`mock-1.0`), данные — в `localStorage` |

Не реализовано: каталог организатора (каталог демонстрационный — производители и
характеристики условные) и его импорт, серверный PDF (PDF — печатью из браузера).
Что реализовано полностью, частично или не реализовано — [docs/limitations.md](docs/limitations.md).

## Запуск в Docker

Нужны Docker 24+ и Docker Compose v2.

```bash
cp .env.example .env            # задайте POSTGRES_PASSWORD и JWT_SECRET (не короче 32 символов)
docker compose up -d --build
```

Откройте <http://localhost:8080>. При первом запуске API создаёт таблицы и заливает демо-каталог
и демо-учётки. Остановить: `docker compose down` (данные БД остаются в томе `pgdata`;
`docker compose down -v` удаляет и их).

Автономное демо без сервера и БД:

```bash
docker build --build-arg VITE_USE_MOCKS=true -t robo-platform-web:demo frontend
docker run -d -p 8080:80 robo-platform-web:demo
```

Переменные окружения, проблемы сборки — [docs/deployment.md](docs/deployment.md).

## Локальный запуск

Нужны Node.js 22.18+ или 24.12+; для бэкенда — .NET SDK 10, рантайм ASP.NET Core 10 и
PostgreSQL на `localhost:5432` (учётка `postgres`/`postgres` — `appsettings.Development.json`).

Команды — из корня репозитория, бэкенд и фронтенд в разных терминалах. База `RoboDb`, таблицы
и демо-данные создаются при первом запуске API.

```bash
# Бэкенд: http://localhost:5203, Swagger — /swagger
cd backend && dotnet run --project src/Robo.Api --launch-profile http

# Фронтенд против бэкенда (Vite проксирует /api на :5203)
cd frontend && npm ci && VITE_USE_MOCKS=false npm run dev

# Фронтенд без бэкенда, на моках (по умолчанию для npm run dev)
cd frontend && npm run dev
```

Проверки:

```bash
cd frontend && npm run type-check && npx vitest run && npm run build
cd backend && dotnet build Robo.slnx && dotnet test Robo.slnx
```

## Демо-учётки

| Роль | Почта | Пароль |
|---|---|---|
| Пользователь | `user@demo.ru` | `Demo12345` |
| Администратор | `admin@demo.ru` | `Admin12345` |

Создаются при первом запуске сервера из `backend/seed/users.json` (пароли там — хэши BCrypt).
Без входа доступны каталог и оценка на `/demo`. На сервере у пользователя сначала нет
проектов; демо-проекты «Подольск» и «Казань» есть только в автономном демо на моках, там же —
кнопка «Сбросить демо-данные» в `/admin/robots`.

## Документация

Вся документация одним файлом в порядке п. 6.1–6.10 ТЗ, с оглавлением —
[docs/documentation.pdf](docs/documentation.pdf). Презентация — [docs/presentation.pptx](docs/presentation.pptx)
и [docs/presentation.pdf](docs/presentation.pdf).

- [docs/overview.md](docs/overview.md) — назначение, аудитория, сценарии и границы решения (п. 6.1)
- [docs/reproduce.md](docs/reproduce.md) — как развернуть и воспроизвести демонстрационный расчёт (п. 6.10)
- [docs/limitations.md](docs/limitations.md) — статус функций по ТЗ, ограничения, план развития
- [docs/architecture.md](docs/architecture.md) — компоненты, стек, схема данных, интеграции
- [docs/economics.md](docs/economics.md) — экономическая модель: формулы, коэффициенты, допущения
- [docs/recommendation.md](docs/recommendation.md) — правила подбора и ранжирования
- [docs/simulation.md](docs/simulation.md) — модель 2D-симуляции и её допущения
- [docs/data.md](docs/data.md) — каталог, справочники, версии данных
- [docs/api.md](docs/api.md) — статус эндпоинтов; [docs/api-examples.md](docs/api-examples.md) — контракт с примерами
- [docs/core-api.md](docs/core-api.md) — как API вызывает расчётное ядро
- [docs/deployment.md](docs/deployment.md) — развёртывание, переменные окружения, локальная разработка
- [docs/user-guide.md](docs/user-guide.md), [docs/admin-guide.md](docs/admin-guide.md) — руководства
- [docs/libraries.md](docs/libraries.md) — зависимости и источники данных
- [docs/manual-test.md](docs/manual-test.md) — сценарии ручной проверки
- [docs/example-report.pdf](docs/example-report.pdf) — пример итогового отчёта (демо-склад)
