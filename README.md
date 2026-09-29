# Платформа подбора роботизированных решений

Хакатон ФЦ БАС. Веб-платформа для экспресс-предынвестиционной оценки роботизации объекта:
выбор объекта → параметры → подбор роботов → сравнение → экономика трёх сценариев
(без роботов, покупка, аренда RaaS) → what-if → 2D-симуляция → отчёт и экспорт.
Для руководителей, технических директоров, логистов и аналитиков — без навыков программирования.

Команда: Амир — фронтенд, расчётное ядро, документация; Ермолай — бэкенд API.

## Что реализовано

**Демо-версия работает целиком в браузере:** фронтенд обслуживает запросы API моками
(`frontend/src/mocks`), данные хранятся в `localStorage` браузера. Полноценного бэкенда пока нет.

| Часть | Состояние |
|---|---|
| Фронтенд (Vue 3 + TypeScript) | Весь путь из 8 шагов для гостя и зарегистрированного пользователя, каталог, проекты и история расчётов, админка каталога, печатный отчёт (PDF через печать), CSV, PNG-схема |
| Типы объектов | Склад, аэропорт, больница: формы по п. 3.2.1 ТЗ, подбор, экономика. 2D-симуляция — только для склада |
| Расчёт подбора и экономики | В демо — модель моков фронтенда (`mock-1.0`). Ядро `backend/src/Robo.Core` — заглушка с фиксированным результатом (`econ-0.1-stub`) |
| 2D-симуляция | Дискретно-событийная модель в браузере (`sim-1.2`), см. [docs/simulation.md](docs/simulation.md) |
| Бэкенд `backend/src/Robo.Api` (.NET 10) | Только `GET /api/v1/robots`, `GET /api/v1/robots/{id}` и `POST /api/v1/robots` без хранения. Нет авторизации, проектов, расчётов, БД ([docs/api.md](docs/api.md)) |
| Excel-выгрузка | Формирует сервер — в демо недоступна |

Каталог роботов демонстрационный: производители и характеристики условные.
Что реализовано полностью, частично или не реализовано — [docs/limitations.md](docs/limitations.md).

## Запуск в Docker (демо)

Нужны Docker 24+ и Docker Compose v2.

```bash
docker compose up -d --build
```

Откройте <http://localhost:8080>. Остановить: `docker compose down`.
Если сборка зависает на `npm ci` (сеть Docker недоступна из-за VPN или прокси) — см.
[docs/deployment.md](docs/deployment.md), раздел «Если сборка падает на `npm ci`».

## Локальный запуск

Нужен Node.js 22.18+ или 24.12+.

```bash
cd frontend
npm ci
npm run dev          # http://localhost:5173, режим моков (frontend/.env.development)
```

Проверки:

```bash
cd frontend && npm run type-check && npx vitest run && npm run build
cd backend && dotnet build Robo.slnx && dotnet test Robo.slnx   # нужен .NET SDK 10
```

## Демо-учётки

| Роль | Почта | Пароль |
|---|---|---|
| Пользователь | `user@demo.ru` | `Demo12345` |
| Администратор | `admin@demo.ru` | `Admin12345` |

Без входа доступны каталог и оценка на `/demo`. Данные демо хранятся в браузере: у каждого
браузера свои. Вернуть исходные данные — «Сбросить демо-данные» в `/admin/robots`.

## Документация

- [docs/limitations.md](docs/limitations.md) — статус функций по ТЗ, ограничения, план развития
- [docs/architecture.md](docs/architecture.md) — компоненты, стек, схема данных, интеграции
- [docs/economics.md](docs/economics.md) — экономическая модель: формулы, коэффициенты, допущения
- [docs/recommendation.md](docs/recommendation.md) — правила подбора и ранжирования
- [docs/simulation.md](docs/simulation.md) — модель 2D-симуляции и её допущения
- [docs/data.md](docs/data.md) — каталог, справочники, версии данных
- [docs/api.md](docs/api.md) — статус эндпоинтов; [docs/api-examples.md](docs/api-examples.md) — контракт с примерами
- [docs/core-api.md](docs/core-api.md) — как API вызывает расчётное ядро
- [docs/deployment.md](docs/deployment.md) — развёртывание, переменные окружения, целевая схема
- [docs/user-guide.md](docs/user-guide.md), [docs/admin-guide.md](docs/admin-guide.md) — руководства
- [docs/libraries.md](docs/libraries.md) — зависимости и источники данных
- [docs/manual-test.md](docs/manual-test.md) — сценарии ручной проверки
- [docs/presentation.pptx](docs/presentation.pptx) — презентация для защиты
- [docs/example-report.pdf](docs/example-report.pdf) — пример итогового отчёта (демо-склад)
