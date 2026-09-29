# API v1: статус эндпоинтов

Контракт — раздел 5 CLAUDE.md и `frontend/src/types/api.ts`. **Запросы и ответы с примерами —
[api-examples.md](api-examples.md)**: все примеры сняты с мок-сервера, и фронтенд работает с
любым сервером, который отвечает так же. Как контроллер расчёта вызывает ядро —
[core-api.md](core-api.md).

Общее: префикс `/api/v1`, JSON, ключи camelCase, id — строки (UUID), даты — ISO 8601 UTC,
деньги — рубли с НДС числом, токен — `Authorization: Bearer <token>`. Ошибки — ProblemDetails с
полем `code` (`VALIDATION_ERROR`, `AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `FORBIDDEN`,
`NOT_FOUND`, `CONFLICT`, `CALCULATION_ERROR`, `SERVER_ERROR`; `NETWORK_ERROR` формирует сам
фронтенд, если сервер недоступен).

## Статус

**Мок** — `frontend/src/mocks/router.ts`, работает в демо. **Robo.Api** — `backend/src/Robo.Api`.

| Метод | Путь | Доступ | Мок | Robo.Api |
|---|---|---|---|---|
| POST | /auth/login | все | есть | нет |
| POST | /auth/register | все | есть | нет |
| GET | /object-types | все | есть | нет (данные готовы: `ConfigLoader.Load`) |
| GET | /robots | все | есть, с фильтрами `objectType`, `solutionType`, `q`, `sort` | частично: пустой список в памяти, фильтры игнорируются |
| GET | /robots/{id} | все | есть | частично: ищет в пустом списке; 404 не в формате ApiError |
| POST | /robots | admin | есть | частично: без проверки роли, ничего не сохраняет, `id` пустой |
| PUT | /robots/{id} | admin | есть | нет |
| DELETE | /robots/{id} | admin | есть | нет |
| GET | /projects | user, admin | есть | нет |
| POST | /projects | user, admin | есть | нет |
| GET | /projects/{id} | владелец | есть | нет |
| PUT | /projects/{id} | владелец | есть | нет |
| DELETE | /projects/{id} | владелец | есть | нет |
| POST | /projects/{id}/copy | владелец | есть | нет |
| POST | /calculations | все | есть (модель `mock-1.0`) | нет (ядро `Robo.Core` — заглушка) |
| GET | /projects/{id}/calculations | владелец | есть | нет |
| GET | /calculations/{id} | владелец | есть | нет |
| GET | /calculations/{id}/report.pdf | владелец | заглушка файла | нет; PDF делается из печатной версии в браузере |
| GET | /calculations/{id}/export.xlsx | владелец | заглушка файла | нет; кнопка Excel в демо неактивна |

## Расхождения Robo.Api с контрактом

В `backend/src/Robo.Api/Contracts/RobotContracts.cs`:

| Контракт | В Robo.Api | Последствие |
|---|---|---|
| `manufacturer` | `manufactures` | фронтенд не увидит производителя |
| `specs.perfOpsPerHour` | `perfOpsPerHouse` | не будет производительности |
| `specs.minAisleM` | `minAislemM` | не будет ширины прохода |
| `specs.heightM` | `heigthM` | не будет высоты |
| `confirmed` | публичное поле без `[JsonInclude]` | не попадает в JSON |
| характеристики `number \| null` | `int`/`float` без `?` | `null` и дробные значения при POST — ошибка 400 |
| `raasMonthlyPrice: number \| null` | `decimal` | робот без аренды — ошибка 400 |

## Ограничения

- Рабочая реализация всех эндпоинтов — только мок-сервер в браузере; для продуктивной работы
  нужен бэкенд.
- OpenAPI-спецификации нет: пакет `Microsoft.AspNetCore.OpenApi` подключён, но в `Program.cs`
  не включён.
- В `Robo.Api.http` проверяется `/weatherforecast/` — такого эндпоинта нет.
