# API v1: статус эндпоинтов

Контракт — раздел 5 CLAUDE.md и `frontend/src/types/api.ts`. **Запросы и ответы с примерами —
[api-examples.md](api-examples.md)**. Как контроллер расчёта вызывает ядро —
[core-api.md](core-api.md). Спецификация OpenAPI отдаётся сервером: `/openapi/v1.json`,
Swagger UI — `/swagger` (при локальном запуске — `http://localhost:5203/swagger`).

Общее: префикс `/api/v1`, JSON, ключи camelCase, id — строки (UUID), даты — ISO 8601 UTC,
деньги — рубли с НДС числом, токен — `Authorization: Bearer <token>` (JWT, 7 дней). Ошибки —
формат `ApiError` с полем `code` (`VALIDATION_ERROR`, `AUTH_REQUIRED`, `INVALID_CREDENTIALS`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `CALCULATION_ERROR`, `SERVER_ERROR`; `NETWORK_ERROR`
формирует сам фронтенд, если сервер недоступен). Нет токена — 401 `AUTH_REQUIRED`, нет прав —
403 `FORBIDDEN`, неизвестный адрес — 404 `NOT_FOUND`, необработанное исключение — 500
`SERVER_ERROR`; всё в том же формате.

## Статус

**Robo.Api** — `backend/src/Robo.Api` (реализация на сервере, хранение в PostgreSQL).
**Мок** — `frontend/src/mocks/router.ts` (автономное демо без сервера, `VITE_USE_MOCKS=true`).

| Метод | Путь | Доступ | Robo.Api | Мок |
|---|---|---|---|---|
| POST | /auth/login | все | есть | есть |
| POST | /auth/register | все | есть | есть |
| GET | /object-types | все | есть (из `backend/config/object-types.json`) | есть |
| GET | /robots | все | есть, с фильтрами `objectType`, `solutionType`, `q`, `sort` | есть |
| GET | /robots/{id} | все | есть | есть |
| POST | /robots | admin | есть | есть |
| PUT | /robots/{id} | admin | есть | есть |
| DELETE | /robots/{id} | admin | есть | есть |
| GET | /projects | user, admin | есть | есть |
| POST | /projects | user, admin | есть | есть |
| GET | /projects/{id} | владелец | есть | есть |
| PUT | /projects/{id} | владелец | есть | есть |
| DELETE | /projects/{id} | владелец | есть (расчёты проекта удаляются каскадом) | есть |
| POST | /projects/{id}/copy | владелец | есть | есть |
| POST | /calculations | все | есть, ядро `econ-1.0+rec-1.0`; без токена или без `projectId` не сохраняется | есть (модель `mock-1.0`) |
| GET | /projects/{id}/calculations | владелец | есть | есть |
| GET | /calculations/{id} | владелец | есть | есть |
| GET | /calculations/{id}/export.xlsx | владелец | есть: 7 листов (сводка, оборудование, денежный поток, подбор, чувствительность, допущения, параметры) | заглушка файла; кнопка Excel в режиме моков неактивна |
| GET | /calculations/{id}/report.pdf | владелец | **501** `SERVER_ERROR` с пояснением: PDF делается из печатной версии отчёта в браузере | заглушка файла |

Чужой проект или расчёт неотличим от несуществующего: 404, в том числе для администратора.

## Проверка

- `backend/tests/Robo.Tests/Api/` — тесты каждого эндпоинта на `WebApplicationFactory` с
  базой InMemory: коды ответов, формат ошибок, изоляция по владельцу, гостевой расчёт.
- Совпадение ответов расчёта сервера и мока — эталонные тесты (`docs/economics.md`,
  «Где считается»).

## Ограничения

- Серверного PDF нет (501).
- Эндпоинтов импорта каталога, объектов и нормативов (п. 3.8.2 ТЗ) нет.
- Диапазоны параметров объекта сервер не проверяет — это делает форма фронтенда.
