# Примеры запросов и ответов API v1

Документ для бэкенда: какие JSON отправляет и ожидает фронтенд. Все примеры — **реальные
ответы мок-сервера** фронтенда (`frontend/src/mocks/router.ts`, данные — `frontend/src/mocks/data/*.ts`),
снятые прогоном `handleMockRequest`. Если бэкенд отвечает так же, фронтенд работает без правок.

Типы — `frontend/src/types/api.ts` (он же раздел 5 CLAUDE.md). Порядок ключей в JSON значения
не имеет. Длинные массивы сокращены до 1–2 элементов с пометкой `// …ещё N элементов`;
структура каждого показанного объекта — полная. UUID и время в ответах на создание генерируются
при каждом запросе, поэтому в примерах они случайные.

## Содержание

| Метод | Путь | Доступ | Токен | Успех |
|---|---|---|---|---|
| POST | /auth/login | гость | нет | 200 |
| POST | /auth/register | гость | нет | 201 |
| GET | /object-types | все | нет | 200 |
| GET | /robots | все | нет | 200 |
| GET | /robots/{id} | все | нет | 200 |
| POST | /robots | admin | да | 201 |
| PUT | /robots/{id} | admin | да | 200 |
| DELETE | /robots/{id} | admin | да | 204 |
| GET | /projects | user, admin (только свои) | да | 200 |
| POST | /projects | user, admin | да | 201 |
| GET | /projects/{id} | владелец | да | 200 |
| PUT | /projects/{id} | владелец | да | 200 |
| DELETE | /projects/{id} | владелец | да | 204 |
| POST | /projects/{id}/copy | владелец | да | 201 |
| POST | /calculations | все (гость или владелец проекта) | необязателен | 200 |
| GET | /projects/{id}/calculations | владелец | да | 200 |
| GET | /calculations/{id} | владелец | да | 200 |
| GET | /calculations/{id}/report.pdf | владелец | да | 200, файл |
| GET | /calculations/{id}/export.xlsx | владелец | да | 200, файл |

«Владелец» — пользователь, создавший проект. Роль admin **не** даёт доступа к чужим проектам
и расчётам: для них ответ такой же, как для несуществующего id, — 404.

---

## Общие правила для бэкенда

### Адреса и формат

- Все пути начинаются с префикса **`/api/v1`**: `POST /api/v1/auth/login`. Ниже префикс опущен.
- Тело запроса и ответа — JSON в UTF-8 (`Content-Type: application/json`). Исключение — файлы
  `report.pdf` и `export.xlsx`.
- Ключи — **camelCase**: `robotId`, `raasMonthlyPrice`, `paybackYears`. В .NET нужны
  `JsonNamingPolicy.CamelCase` и такое же именование ключей словарей (`Params`, `Metric.inputs`).
- **id — строки UUID**: `"b1f0a3c2-1111-4a01-9c01-000000000001"`, не числа. Исключение —
  `ScenarioInput.id`: его задаёт фронтенд (`"baseline"`, `"purchase"`, `"raas"`), сервер
  возвращает этот id в `ScenarioResult.id` и `SensitivitySeries.scenarioId` без изменений.
- **Даты — ISO 8601 в UTC с `Z`**: `"2026-09-15T12:10:00Z"` (миллисекунды допустимы:
  `"2026-09-22T11:26:28.222Z"`). Для даты без времени (`Robot.sourceDate`) — `"2026-06-15"`.
- Деньги — рубли с НДС, **числом**: `4200000`, не `"4 200 000 ₽"`. Форматирует фронтенд.
- Доли в запросе (`Assumptions.utilization`, `reserveShare`, …) — дробью от 0 до 1: `0.85`.
  В ответе `AssumptionRef.value` для этих же величин — в процентах (`85`, `unit: "%"`), так
  сделано в моке и так ожидает экран.

### Перечисления — строками

Все перечисления передаются **строковыми значениями из контракта**, не числами и не
PascalCase. В .NET нужен `JsonStringEnumConverter` с camelCase-политикой, а для значений
со знаком подчёркивания — явные имена (`needs_check`).

| Тип | Значения |
|---|---|
| Role | `"user"`, `"admin"` |
| ErrorCode | `"VALIDATION_ERROR"`, `"AUTH_REQUIRED"`, `"INVALID_CREDENTIALS"`, `"FORBIDDEN"`, `"NOT_FOUND"`, `"CONFLICT"`, `"CALCULATION_ERROR"`, `"SERVER_ERROR"` |
| ParamField.type | `"number"`, `"integer"`, `"enum"`, `"boolean"`, `"string"` |
| Zone.type | `"receiving"`, `"storage"`, `"picking"`, `"shipping"`, `"charging"`, `"other"` |
| ScenarioKind | `"baseline"`, `"purchase"`, `"raas"` |
| SensParam | `"equipmentPrice"`, `"operationsVolume"`, `"laborCost"` |
| CheckResult | `"pass"`, `"fail"`, `"unknown"` |
| RecStatus | `"recommended"`, `"excluded"`, `"needs_check"` |
| MetricKey (ключи `ScenarioResult.metrics`) | `"robotCount"`, `"capexRub"`, `"opexAnnualRub"`, `"opexDeltaRub"`, `"annualEffectRub"`, `"paybackYears"`, `"roiPercent"`, `"tcoRub"` |
| Verdict.level | `"good"`, `"moderate"`, `"poor"`, `"negative"` |

`NETWORK_ERROR` сервер не отправляет никогда: его формирует сам фронтенд, если сервер не ответил.

### null не опускается

- Поле с типом `T | null` присутствует **всегда**; если значения нет, передаётся `null`.
  Нельзя пропускать ключ и нельзя подменять `null` на `0` или `""`: `null` означает «нет
  данных», фронтенд показывает «—» и пометку «требует проверки».
  В .NET: не включать `DefaultIgnoreCondition = WhenWritingNull`.
- Поля с `?` в контракте (`FieldError.hint`, `ApiError.errors`, `Metric.breakdown`,
  `Metric.inputs`, `ParamField.unit/min/max/...`, `Zone.slots`) можно не передавать.
- `Metric` выдаётся по **всем 8 ключам** `MetricKey`, даже если значение `null`.
- `Check` в моке всегда содержит `required`, `actual` и `unit` (при отсутствии — `null`).

Робот из каталога моков с неполными данными — `null` в полях, а не пропущенные ключи:

```jsonc
{
  "id": "b1f0a3c2-1111-4a01-9c01-000000000004",
  "name": "ФМР-12 Узкопроходный",
  "manufacturer": "Восток Автоматика",
  "solutionType": "fmr",
  "solutionTypeName": "FMR — автономный вилочный погрузчик",
  "objectTypes": ["warehouse"],
  "country": "Китай",
  "availability": "По запросу",
  "price": 11200000,
  "raasMonthlyPrice": null,
  "maintenancePerYear": 850000,
  "specs": {
    "payloadKg": 1200, "speedMps": 1.1, "perfOpsPerHour": null, "autonomyH": null,
    "chargeTimeH": null, "positioningMm": 5, "navigation": "Лидар, SLAM", "minAisleM": 1.9,
    "widthM": 1, "lengthM": 2.1, "heightM": null, "lifeYears": null
  },
  "sourceUrl": null,
  "sourceDate": "2026-03-02",
  "confirmed": false
}
```

### Авторизация

- Токен передаётся заголовком **`Authorization: Bearer <token>`**. Сам токен фронтенд не
  разбирает — формат любой (в моке `mock-token:<userId>`, на бэкенде обычно JWT).
- Токен выдают `POST /auth/login` и `POST /auth/register` в поле `token`.
- **401 на любой запрос, кроме `/auth/*`, фронтенд считает концом сессии**: удаляет токен и
  отправляет пользователя на страницу входа. Поэтому 401 — только для «нет токена или он
  недействителен». Нехватку прав сообщает 403 `FORBIDDEN`, чужой ресурс — 404 `NOT_FOUND`.
- На `/auth/login` 401 `INVALID_CREDENTIALS` означает неверный пароль — пользователь
  остаётся на форме.

### Формат ошибок (ProblemDetails)

Любой ответ 4xx/5xx — JSON вида `ApiError`:

```jsonc
{
  "status": 400,                  // совпадает с HTTP-статусом
  "code": "VALIDATION_ERROR",     // ErrorCode — по нему фронтенд выбирает реакцию
  "title": "Проверьте введённые данные",   // показывается пользователю как есть, по-русски
  "errors": [                     // необязательно; только для ошибок полей
    { "field": "password", "message": "Пароль должен быть не короче 8 символов", "hint": "Используйте буквы и цифры" }
  ]
}
```

- `title` видит пользователь: фраза на русском, которая говорит, что не так и как исправить.
- `errors[].field` — ключ поля в camelCase, как в теле запроса; вложенные поля — путём
  JS: `"scenarios[0].robotId"`. По `field` фронтенд подсвечивает поле формы.
- Лишние поля ProblemDetails (`type`, `traceId`, `detail`) не мешают — фронтенд их игнорирует.
- Страховка: если `code` отсутствует, фронтенд выводит его из статуса (400/422 →
  VALIDATION_ERROR, 401 → AUTH_REQUIRED, 403 → FORBIDDEN, 404 → NOT_FOUND, 409 → CONFLICT,
  прочие → SERVER_ERROR). Словарь ошибок ASP.NET по умолчанию (`"errors": { "Password": ["..."] }`)
  тоже разбирается. Но правильный формат — массив `FieldError[]` и явный `code`.

Ошибки, которые может вернуть **любой** эндпоинт (в разделах ниже не повторяются):

**500 SERVER_ERROR** — непредвиденная ошибка сервера (в моке — при исключении в обработчике):

```jsonc
{ "status": 500, "code": "SERVER_ERROR", "title": "Ошибка на сервере. Повторите попытку позже" }
```

**404 NOT_FOUND** — неизвестный адрес (ответ мока):

```jsonc
{ "status": 404, "code": "NOT_FOUND", "title": "Адрес GET /unknown не найден" }
```

---

## Авторизация

### POST /auth/login

Вход. Доступ: гость. Токен: не нужен.

Запрос:

```jsonc
{ "email": "user@demo.ru", "password": "Demo12345" }
```

Ответ **200 OK** — `AuthResponse`:

```jsonc
{
  "token": "mock-token:6f1c2a3e-8b4d-4e21-9a57-1c0d3b2e4f01",
  "user": {
    "id": "6f1c2a3e-8b4d-4e21-9a57-1c0d3b2e4f01",
    "email": "user@demo.ru",
    "name": "Ирина Смирнова",
    "role": "user"
  }
}
```

Ошибки:

**401 INVALID_CREDENTIALS** — нет такой почты или неверный пароль (почта сравнивается без
учёта регистра и пробелов по краям):

```jsonc
{
  "status": 401,
  "code": "INVALID_CREDENTIALS",
  "title": "Неверная почта или пароль. Проверьте раскладку и Caps Lock"
}
```

### POST /auth/register

Регистрация. Всегда создаётся роль `"user"`. Доступ: гость. Токен: не нужен.

Запрос:

```jsonc
{ "email": "petrov@company.ru", "password": "Secret123", "name": "Пётр Петров" }
```

Ответ **201 Created** — `AuthResponse`, пользователь сразу считается вошедшим:

```jsonc
{
  "token": "mock-token:30dbc692-5ee7-4b5e-a02c-8e677463e880",
  "user": {
    "id": "30dbc692-5ee7-4b5e-a02c-8e677463e880",
    "email": "petrov@company.ru",
    "name": "Пётр Петров",
    "role": "user"
  }
}
```

Ошибки:

**400 VALIDATION_ERROR** — некорректная почта, пароль короче 8 символов, пустое имя; все
ошибки полей приходят сразу:

```jsonc
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "title": "Проверьте введённые данные",
  "errors": [
    {
      "field": "email",
      "message": "Введите корректный адрес почты",
      "hint": "Например: ivanov@company.ru"
    },
    {
      "field": "password",
      "message": "Пароль должен быть не короче 8 символов",
      "hint": "Используйте буквы и цифры"
    },
    { "field": "name", "message": "Укажите имя", "hint": "Как к вам обращаться" }
  ]
}
```

**409 CONFLICT** — почта уже занята (проверяется после валидации):

```jsonc
{
  "status": 409,
  "code": "CONFLICT",
  "title": "Пользователь с такой почтой уже зарегистрирован — войдите или укажите другую почту"
}
```

---

## Типы объектов

### GET /object-types

Справочник типов объектов: поля формы параметров, процессы, демо-параметры, план для
симуляции. Доступ: все. Токен: не нужен. Query-параметров нет.

Ответ **200 OK** — `ObjectType[]`. У склада 16 полей; ниже показаны три с разными
вариантами структуры: число, перечисление с `options` и поле с `defaultSource`.

```jsonc
[
  {
    "code": "warehouse",
    "name": "Склад",
    "description": "Распределительный центр или склад готовой продукции: приёмка, хранение, внутреннее перемещение, отбор и отгрузка.",
    "processes": [
      { "code": "receiving", "name": "Приёмка и размещение" },
      { "code": "internal_transport", "name": "Внутреннее перемещение" }
      // …ещё 3 элемента
    ],
    "groups": [
      { "key": "object", "label": "Объект и режим работы" },
      { "key": "operations", "label": "Объёмы операций" }
      // …ещё 3 элемента
    ],
    "fields": [
      {
        "key": "areaM2",
        "label": "Площадь склада",
        "group": "object",
        "type": "number",
        "unit": "м²",
        "required": true,
        "min": 100,
        "max": 500000,
        "default": 12000,
        "example": 12000,
        "hint": "Общая площадь складских помещений без офисов"
      },
      {
        "key": "workMode",
        "label": "Режим работы",
        "group": "object",
        "type": "enum",
        "required": true,
        "default": "2x8",
        "options": [
          { "value": "1x8", "label": "1 смена по 8 ч" },
          { "value": "2x8", "label": "2 смены по 8 ч" },
          { "value": "2x12", "label": "2 смены по 12 ч" },
          { "value": "3x8", "label": "Круглосуточно, 3 смены по 8 ч" }
        ],
        "hint": "Сколько смен в сутки работает склад"
      },
      {
        "key": "unitLengthM",
        "label": "Длина грузовой единицы",
        "group": "goods",
        "type": "number",
        "unit": "м",
        "required": true,
        "min": 0.1,
        "max": 6,
        "default": 1.2,
        "example": 1.2,
        "hint": "Для европаллеты — 1,2 м",
        "defaultSource": { "source": "ГОСТ 33757-2016 (поддон 1200×800)", "confirmed": true }
      }
      // …ещё 13 элементов
    ],
    "demoParams": {
      "areaM2": 12000,
      "workMode": "2x8",
      "inboundPerDay": 1200,
      "internalPerDay": 2500,
      "outboundPerDay": 1800,
      "processPerfPerHour": 350,
      "storageType": "pallet_rack",
      "skuCount": 8500,
      "unitWeightKg": 350,
      "unitLengthM": 1.2,
      "unitWidthM": 0.8,
      "unitHeightM": 1.5,
      "staffCount": 64,
      "staffCostMonthRub": 95000,
      "avgRouteM": 120,
      "aisleWidthM": 3
    },
    "layout": {
      "widthM": 120,
      "heightM": 100,
      "zones": [
        {
          "id": "z-receiving",
          "type": "receiving",
          "label": "Приёмка",
          "rect": [0, 0, 25, 40],
          "slots": 8
        },
        {
          "id": "z-storage",
          "type": "storage",
          "label": "Зона хранения",
          "rect": [30, 0, 90, 70],
          "slots": 2400
        }
        // …ещё 3 элемента
      ]
    }
  }
  // …ещё 2 элемента (airport, hospital; у них "layout": null)
]
```

Ошибки: только общие.

---

## Каталог роботов

### GET /robots

Список роботов с фильтрами. Доступ: все. Токен: не нужен. Тела нет.

Query-параметры (все необязательные; пустые фронтенд не передаёт):

| Параметр | Пример | Смысл в моке |
|---|---|---|
| objectType | `warehouse` | робот подходит для типа объекта (`objectTypes` содержит значение) |
| solutionType | `amr` | точное совпадение `solutionType` |
| q | `логимов` | подстрока в `name` или `manufacturer`, без учёта регистра |
| sort | `-price` | `name`, `price` или ключ `specs` (`payloadKg`, `perfOpsPerHour`, …); префикс `-` — по убыванию; `null` в `specs` считается меньше любого числа |

Пример: `GET /api/v1/robots?objectType=warehouse&solutionType=amr&q=%D0%BB%D0%BE%D0%B3%D0%B8%D0%BC%D0%BE%D0%B2&sort=-price`
(`q=логимов`).

Ответ **200 OK** — `Robot[]`; пустой результат — `[]`, не 404:

```jsonc
[
  {
    "id": "b1f0a3c2-1111-4a01-9c01-000000000002",
    "name": "Логимов AMR-1500",
    "manufacturer": "Логимов Роботикс",
    "solutionType": "amr",
    "solutionTypeName": "AMR — автономный мобильный робот",
    "objectTypes": ["warehouse"],
    "country": "Россия",
    "availability": "Поставка 10–12 недель",
    "price": 6800000,
    "raasMonthlyPrice": 175000,
    "maintenancePerYear": 480000,
    "specs": {
      "payloadKg": 1500,
      "speedMps": 1.2,
      "perfOpsPerHour": 35,
      "autonomyH": 8,
      "chargeTimeH": 2,
      "positioningMm": 10,
      "navigation": "Лидар, SLAM",
      "minAisleM": 1.8,
      "widthM": 1.2,
      "lengthM": 1.6,
      "heightM": 0.4,
      "lifeYears": 7
    },
    "sourceUrl": "https://example.com/catalog/logimov-amr-1500",
    "sourceDate": "2026-06-15",
    "confirmed": true
  },
  {
    "id": "b1f0a3c2-1111-4a01-9c01-000000000001",
    "name": "Логимов AMR-600",
    "manufacturer": "Логимов Роботикс",
    "solutionType": "amr",
    "solutionTypeName": "AMR — автономный мобильный робот",
    "objectTypes": ["warehouse", "hospital"],
    "country": "Россия",
    "availability": "Поставка 8–10 недель",
    "price": 4200000,
    "raasMonthlyPrice": 115000,
    "maintenancePerYear": 320000,
    "specs": {
      "payloadKg": 600,
      "speedMps": 1.5,
      "perfOpsPerHour": 45,
      "autonomyH": 10,
      "chargeTimeH": 1.5,
      "positioningMm": 10,
      "navigation": "Лидар, SLAM",
      "minAisleM": 1.2,
      "widthM": 0.95,
      "lengthM": 1.3,
      "heightM": 0.3,
      "lifeYears": 7
    },
    "sourceUrl": "https://example.com/catalog/logimov-amr-600",
    "sourceDate": "2026-06-15",
    "confirmed": true
  }
]
```

Ошибки: только общие.

### GET /robots/{id}

Карточка робота. Доступ: все. Токен: не нужен.

Пример: `GET /api/v1/robots/b1f0a3c2-1111-4a01-9c01-000000000001`

Ответ **200 OK** — `Robot`:

```jsonc
{
  "id": "b1f0a3c2-1111-4a01-9c01-000000000001",
  "name": "Логимов AMR-600",
  "manufacturer": "Логимов Роботикс",
  "solutionType": "amr",
  "solutionTypeName": "AMR — автономный мобильный робот",
  "objectTypes": ["warehouse", "hospital"],
  "country": "Россия",
  "availability": "Поставка 8–10 недель",
  "price": 4200000,
  "raasMonthlyPrice": 115000,
  "maintenancePerYear": 320000,
  "specs": {
    "payloadKg": 600,
    "speedMps": 1.5,
    "perfOpsPerHour": 45,
    "autonomyH": 10,
    "chargeTimeH": 1.5,
    "positioningMm": 10,
    "navigation": "Лидар, SLAM",
    "minAisleM": 1.2,
    "widthM": 0.95,
    "lengthM": 1.3,
    "heightM": 0.3,
    "lifeYears": 7
  },
  "sourceUrl": "https://example.com/catalog/logimov-amr-600",
  "sourceDate": "2026-06-15",
  "confirmed": true
}
```

Ошибки:

**404 NOT_FOUND** — робота нет:

```jsonc
{ "status": 404, "code": "NOT_FOUND", "title": "Робот не найден — возможно, он был удалён" }
```

### POST /robots

Добавить робота в каталог. Доступ: admin. Токен: нужен.

Запрос — `RobotInput` (`Robot` без `id`):

```jsonc
{
  "name": "Логимов AMR-800",
  "manufacturer": "Логимов Роботикс",
  "solutionType": "amr",
  "solutionTypeName": "AMR — автономный мобильный робот",
  "objectTypes": ["warehouse"],
  "country": "Россия",
  "availability": "Поставка 8–10 недель",
  "price": 5100000,
  "raasMonthlyPrice": 135000,
  "maintenancePerYear": 390000,
  "specs": {
    "payloadKg": 800, "speedMps": 1.4, "perfOpsPerHour": 40, "autonomyH": 9, "chargeTimeH": 1.5,
    "positioningMm": 10, "navigation": "Лидар, SLAM", "minAisleM": 1.4, "widthM": 1,
    "lengthM": 1.4, "heightM": 0.35, "lifeYears": 7
  },
  "sourceUrl": "https://example.com/catalog/logimov-amr-800",
  "sourceDate": "2026-09-01",
  "confirmed": true
}
```

Ответ **201 Created** — созданный `Robot` с новым `id`:

```jsonc
{
  "id": "2fe5db38-a6a3-4b2c-8c78-0c9fa89f907f",
  "name": "Логимов AMR-800",
  "manufacturer": "Логимов Роботикс",
  "solutionType": "amr",
  "solutionTypeName": "AMR — автономный мобильный робот",
  "objectTypes": ["warehouse"],
  "country": "Россия",
  "availability": "Поставка 8–10 недель",
  "price": 5100000,
  "raasMonthlyPrice": 135000,
  "maintenancePerYear": 390000,
  "specs": {
    "payloadKg": 800,
    "speedMps": 1.4,
    "perfOpsPerHour": 40,
    "autonomyH": 9,
    "chargeTimeH": 1.5,
    "positioningMm": 10,
    "navigation": "Лидар, SLAM",
    "minAisleM": 1.4,
    "widthM": 1,
    "lengthM": 1.4,
    "heightM": 0.35,
    "lifeYears": 7
  },
  "sourceUrl": "https://example.com/catalog/logimov-amr-800",
  "sourceDate": "2026-09-01",
  "confirmed": true
}
```

Ошибки (проверяются в этом порядке):

**401 AUTH_REQUIRED** — нет токена:

```jsonc
{ "status": 401, "code": "AUTH_REQUIRED", "title": "Войдите в систему, чтобы продолжить" }
```

**403 FORBIDDEN** — токен пользователя с ролью `"user"`:

```jsonc
{ "status": 403, "code": "FORBIDDEN", "title": "Изменять каталог может только администратор" }
```

**400 VALIDATION_ERROR** — пустые `name`, `manufacturer` или `price <= 0`:

```jsonc
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "title": "Проверьте введённые данные",
  "errors": [
    { "field": "name", "message": "Укажите название робота" },
    {
      "field": "price",
      "message": "Цена должна быть больше нуля",
      "hint": "Цена в рублях с НДС, например 4200000"
    }
  ]
}
```

### PUT /robots/{id}

Полная замена данных робота (тело — весь `RobotInput`, как в POST). Доступ: admin. Токен: нужен.

Пример: `PUT /api/v1/robots/2fe5db38-a6a3-4b2c-8c78-0c9fa89f907f` с телом из примера POST,
где `"price": 4990000`.

Ответ **200 OK** — обновлённый `Robot`:

```jsonc
{
  "id": "2fe5db38-a6a3-4b2c-8c78-0c9fa89f907f",
  "name": "Логимов AMR-800",
  "manufacturer": "Логимов Роботикс",
  "solutionType": "amr",
  "solutionTypeName": "AMR — автономный мобильный робот",
  "objectTypes": ["warehouse"],
  "country": "Россия",
  "availability": "Поставка 8–10 недель",
  "price": 4990000,
  "raasMonthlyPrice": 135000,
  "maintenancePerYear": 390000,
  "specs": {
    "payloadKg": 800,
    "speedMps": 1.4,
    "perfOpsPerHour": 40,
    "autonomyH": 9,
    "chargeTimeH": 1.5,
    "positioningMm": 10,
    "navigation": "Лидар, SLAM",
    "minAisleM": 1.4,
    "widthM": 1,
    "lengthM": 1.4,
    "heightM": 0.35,
    "lifeYears": 7
  },
  "sourceUrl": "https://example.com/catalog/logimov-amr-800",
  "sourceDate": "2026-09-01",
  "confirmed": true
}
```

Ошибки: **401 AUTH_REQUIRED** и **403 FORBIDDEN** — как у POST /robots; **400 VALIDATION_ERROR** —
как у POST /robots; а также

**404 NOT_FOUND** — робота нет:

```jsonc
{ "status": 404, "code": "NOT_FOUND", "title": "Робот не найден — возможно, он был удалён" }
```

### DELETE /robots/{id}

Удалить робота из каталога. Доступ: admin. Токен: нужен. Тела нет.

Пример: `DELETE /api/v1/robots/2fe5db38-a6a3-4b2c-8c78-0c9fa89f907f`

Ответ **204 No Content** — без тела.

Ошибки: **401 AUTH_REQUIRED** и **403 FORBIDDEN** — как у POST /robots; а также

**404 NOT_FOUND**:

```jsonc
{ "status": 404, "code": "NOT_FOUND", "title": "Робот не найден — возможно, он был удалён" }
```

---

## Проекты

Все эндпоинты проектов требуют токен. Пользователь видит только свои проекты; чужой или
несуществующий `id` → 404.

### GET /projects

Список проектов текущего пользователя, новые сверху (по `updatedAt`). Доступ: user, admin.
Токен: нужен. Query-параметров нет.

Ответ **200 OK** — `ProjectSummary[]`. `lastPaybackYears` — наименьший срок окупаемости
среди сценариев последнего расчёта проекта; `null`, если расчётов нет или ни один сценарий
не окупается:

```jsonc
[
  {
    "id": "c2d4e6f8-2222-4b02-9d02-000000000001",
    "name": "РЦ «Подольск» — роботизация внутреннего транспорта",
    "objectType": "warehouse",
    "updatedAt": "2026-09-15T12:10:00Z",
    "lastPaybackYears": 0.64
  },
  {
    "id": "c2d4e6f8-2222-4b02-9d02-000000000002",
    "name": "Склад «Казань-Север» — ночная смена",
    "objectType": "warehouse",
    "updatedAt": "2026-09-10T09:00:00Z",
    "lastPaybackYears": null
  }
]
```

Ошибки:

**401 AUTH_REQUIRED** — нет токена:

```jsonc
{ "status": 401, "code": "AUTH_REQUIRED", "title": "Войдите в систему, чтобы продолжить" }
```

### POST /projects

Создать проект. Доступ: user, admin. Токен: нужен.

Запрос — `ProjectInput`. `params` — словарь «ключ поля из `ObjectType.fields` → значение»;
значения — число, строка, boolean или `null`:

```jsonc
{
  "name": "РЦ «Химки» — приёмка",
  "objectType": "warehouse",
  "params": {
    "areaM2": 12000, "workMode": "2x8", "inboundPerDay": 1200, "internalPerDay": 2500,
    "outboundPerDay": 1800, "processPerfPerHour": 350, "storageType": "pallet_rack",
    "skuCount": 8500, "unitWeightKg": 350, "unitLengthM": 1.2, "unitWidthM": 0.8,
    "unitHeightM": 1.5, "staffCount": 64, "staffCostMonthRub": 95000, "avgRouteM": 120,
    "aisleWidthM": 3
  },
  "assumptions": {
    "horizonYears": 5, "workDaysPerYear": 250, "shiftsPerDay": 2, "hoursPerShift": 8,
    "utilization": 0.85, "availability": 0.95, "reserveShare": 0.1, "staffReplacedShare": 0.3
  }
}
```

Ответ **201 Created** — `Project`; `createdAt` и `updatedAt` равны:

```jsonc
{
  "id": "0ea29572-6744-431b-99fb-d46a71a2fdbf",
  "name": "РЦ «Химки» — приёмка",
  "objectType": "warehouse",
  "params": {
    "areaM2": 12000,
    "workMode": "2x8",
    "inboundPerDay": 1200,
    "internalPerDay": 2500,
    "outboundPerDay": 1800,
    "processPerfPerHour": 350,
    "storageType": "pallet_rack",
    "skuCount": 8500,
    "unitWeightKg": 350,
    "unitLengthM": 1.2,
    "unitWidthM": 0.8,
    "unitHeightM": 1.5,
    "staffCount": 64,
    "staffCostMonthRub": 95000,
    "avgRouteM": 120,
    "aisleWidthM": 3
  },
  "assumptions": {
    "horizonYears": 5,
    "workDaysPerYear": 250,
    "shiftsPerDay": 2,
    "hoursPerShift": 8,
    "utilization": 0.85,
    "availability": 0.95,
    "reserveShare": 0.1,
    "staffReplacedShare": 0.3
  },
  "createdAt": "2026-09-22T11:26:28.222Z",
  "updatedAt": "2026-09-22T11:26:28.222Z"
}
```

Ошибки:

**401 AUTH_REQUIRED** — нет токена (тело как у GET /projects).

**400 VALIDATION_ERROR** — пустое название или неизвестный `objectType`:

```jsonc
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "title": "Проверьте введённые данные",
  "errors": [
    {
      "field": "name",
      "message": "Укажите название проекта",
      "hint": "Например: «Склад Подольск — роботизация приёмки»"
    },
    { "field": "objectType", "message": "Выберите тип объекта из списка" }
  ]
}
```

### GET /projects/{id}

Проект целиком. Доступ: владелец. Токен: нужен.

Пример: `GET /api/v1/projects/c2d4e6f8-2222-4b02-9d02-000000000001`

Ответ **200 OK** — `Project`:

```jsonc
{
  "id": "c2d4e6f8-2222-4b02-9d02-000000000001",
  "name": "РЦ «Подольск» — роботизация внутреннего транспорта",
  "objectType": "warehouse",
  "params": {
    "areaM2": 12000,
    "workMode": "2x8",
    "inboundPerDay": 1200,
    "internalPerDay": 2500,
    "outboundPerDay": 1800,
    "processPerfPerHour": 350,
    "storageType": "pallet_rack",
    "skuCount": 8500,
    "unitWeightKg": 350,
    "unitLengthM": 1.2,
    "unitWidthM": 0.8,
    "unitHeightM": 1.5,
    "staffCount": 64,
    "staffCostMonthRub": 95000,
    "avgRouteM": 120,
    "aisleWidthM": 3
  },
  "assumptions": {
    "horizonYears": 5,
    "workDaysPerYear": 250,
    "shiftsPerDay": 2,
    "hoursPerShift": 8,
    "utilization": 0.85,
    "availability": 0.95,
    "reserveShare": 0.1,
    "staffReplacedShare": 0.3
  },
  "createdAt": "2026-09-01T07:30:00Z",
  "updatedAt": "2026-09-15T12:10:00Z"
}
```

Ошибки:

**401 AUTH_REQUIRED** — нет токена (тело как у GET /projects).

**404 NOT_FOUND** — проекта нет или он чужой (в том числе для admin):

```jsonc
{ "status": 404, "code": "NOT_FOUND", "title": "Проект не найден — возможно, он был удалён" }
```

### PUT /projects/{id}

Сохранить проект: полная замена `name`, `objectType`, `params`, `assumptions`. Сервер
обновляет `updatedAt`; `id` и `createdAt` не меняются. Доступ: владелец. Токен: нужен.

Запрос — `ProjectInput`, как в POST /projects (в примере изменено `name` на
`"РЦ «Химки» — приёмка и отгрузка"`).

Ответ **200 OK** — `Project`:

```jsonc
{
  "id": "0ea29572-6744-431b-99fb-d46a71a2fdbf",
  "name": "РЦ «Химки» — приёмка и отгрузка",
  "objectType": "warehouse",
  "params": {
    "areaM2": 12000,
    "workMode": "2x8",
    "inboundPerDay": 1200,
    "internalPerDay": 2500,
    "outboundPerDay": 1800,
    "processPerfPerHour": 350,
    "storageType": "pallet_rack",
    "skuCount": 8500,
    "unitWeightKg": 350,
    "unitLengthM": 1.2,
    "unitWidthM": 0.8,
    "unitHeightM": 1.5,
    "staffCount": 64,
    "staffCostMonthRub": 95000,
    "avgRouteM": 120,
    "aisleWidthM": 3
  },
  "assumptions": {
    "horizonYears": 5,
    "workDaysPerYear": 250,
    "shiftsPerDay": 2,
    "hoursPerShift": 8,
    "utilization": 0.85,
    "availability": 0.95,
    "reserveShare": 0.1,
    "staffReplacedShare": 0.3
  },
  "createdAt": "2026-09-22T11:26:28.222Z",
  "updatedAt": "2026-09-22T11:26:28.222Z"
}
```

Ошибки: **401 AUTH_REQUIRED**; **404 NOT_FOUND** — как у GET /projects/{id};
**400 VALIDATION_ERROR** — как у POST /projects.

### DELETE /projects/{id}

Удалить проект вместе с его расчётами. Доступ: владелец. Токен: нужен. Тела нет.

Пример: `DELETE /api/v1/projects/0ea29572-6744-431b-99fb-d46a71a2fdbf`

Ответ **204 No Content** — без тела.

Ошибки: **401 AUTH_REQUIRED**; **404 NOT_FOUND** — как у GET /projects/{id}.

### POST /projects/{id}/copy

Копия проекта: новый `id`, к названию добавляется « (копия)», `createdAt` = `updatedAt` =
сейчас. Расчёты не копируются. Доступ: владелец. Токен: нужен. Тела нет.

Пример: `POST /api/v1/projects/c2d4e6f8-2222-4b02-9d02-000000000001/copy`

Ответ **201 Created** — новый `Project`:

```jsonc
{
  "id": "8ffbf49f-590c-4a03-bf9e-e5ddbbefdd8a",
  "name": "РЦ «Подольск» — роботизация внутреннего транспорта (копия)",
  "objectType": "warehouse",
  "params": {
    "areaM2": 12000,
    "workMode": "2x8",
    "inboundPerDay": 1200,
    "internalPerDay": 2500,
    "outboundPerDay": 1800,
    "processPerfPerHour": 350,
    "storageType": "pallet_rack",
    "skuCount": 8500,
    "unitWeightKg": 350,
    "unitLengthM": 1.2,
    "unitWidthM": 0.8,
    "unitHeightM": 1.5,
    "staffCount": 64,
    "staffCostMonthRub": 95000,
    "avgRouteM": 120,
    "aisleWidthM": 3
  },
  "assumptions": {
    "horizonYears": 5,
    "workDaysPerYear": 250,
    "shiftsPerDay": 2,
    "hoursPerShift": 8,
    "utilization": 0.85,
    "availability": 0.95,
    "reserveShare": 0.1,
    "staffReplacedShare": 0.3
  },
  "createdAt": "2026-09-22T11:26:28.222Z",
  "updatedAt": "2026-09-22T11:26:28.222Z"
}
```

Ошибки: **401 AUTH_REQUIRED**; **404 NOT_FOUND** — как у GET /projects/{id}.

---

## Расчёт

### POST /calculations

Подбор роботов, экономика по сценариям, чувствительность. Доступ: все. Токен: необязателен.

- **Гость** (нет токена или `projectId: null`): расчёт не сохраняется, `calculationId: null`.
  В моке `projectId` без токена тоже даёт гостевой расчёт, а не 401.
- **Пользователь** (токен и `projectId` своего проекта): расчёт сохраняется в историю
  проекта, в ответе — `calculationId`, у проекта обновляется `updatedAt`.
- `scenarios: []` → считаются подбор и один сценарий `baseline` («Текущее состояние»);
  ряды чувствительности строятся только для сценариев `purchase` и `raas`, поэтому
  `sensitivity: []`.
- `recommendation` строится всегда, по всем роботам каталога, подходящим к `objectType`
  (роботы-уборщики — только если в `processes` есть `"cleaning"`).
- `simulation` сервер сохраняет вместе с запросом (показывается в истории); на расчёт
  в моке не влияет.

#### Пример 1. Гость, без сценариев

Запрос:

```jsonc
{
  "projectId": null,
  "objectType": "warehouse",
  "processes": ["internal_transport", "receiving"],
  "params": {
    "areaM2": 12000,
    "workMode": "2x8",
    "inboundPerDay": 1200,
    "internalPerDay": 2500,
    "outboundPerDay": 1800,
    "processPerfPerHour": 350,
    "storageType": "pallet_rack",
    "skuCount": 8500,
    "unitWeightKg": 350,
    "unitLengthM": 1.2,
    "unitWidthM": 0.8,
    "unitHeightM": 1.5,
    "staffCount": 64,
    "staffCostMonthRub": 95000,
    "avgRouteM": 120,
    "aisleWidthM": 3
  },
  "assumptions": {
    "horizonYears": 5,
    "workDaysPerYear": 250,
    "shiftsPerDay": 2,
    "hoursPerShift": 8,
    "utilization": 0.85,
    "availability": 0.95,
    "reserveShare": 0.1,
    "staffReplacedShare": 0.3
  },
  "scenarios": [],
  "sensitivity": {
    "params": ["equipmentPrice", "operationsVolume", "laborCost"],
    "deltas": [-0.2, -0.1, 0.1, 0.2]
  },
  "simulation": null
}
```

Ответ **200 OK** — `CalcResult`:

```jsonc
{
  "calculationId": null,
  "modelVersion": "mock-1.0",
  "dataVersion": "catalog-2026.09",
  "calculatedAt": "2026-09-22T11:26:28.223Z",
  "disclaimer": "Предварительная оценка на основе введённых параметров и каталожных данных. Точность ±30 %. Не является инвестиционным решением: перед закупкой требуется обследование объекта и коммерческие предложения поставщиков.",
  "recommendation": [
    {
      "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
      "name": "Логимов AMR-600",
      "solutionType": "amr",
      "status": "recommended",
      "score": 81.4,
      "checks": [
        {
          "rule": "payload",
          "label": "Грузоподъёмность",
          "critical": true,
          "result": "pass",
          "required": 350,
          "actual": 600,
          "unit": "кг",
          "message": "Грузоподъёмность 600 кг достаточна для единицы 350 кг"
        },
        {
          "rule": "dataConfirmed",
          "label": "Достоверность данных",
          "critical": false,
          "result": "pass",
          "required": null,
          "actual": null,
          "unit": null,
          "message": "Характеристики подтверждены источником"
        }
        // …ещё 3 элемента
      ],
      "scoreBreakdown": [
        {
          "factor": "economy",
          "label": "Экономика (окупаемость)",
          "weight": 0.35,
          "value": 54,
          "contribution": 18.9
        },
        {
          "factor": "performance",
          "label": "Производительность",
          "weight": 0.25,
          "value": 100,
          "contribution": 25
        }
        // …ещё 3 элемента
      ],
      "missingData": []
    },
    {
      "robotId": "b1f0a3c2-1111-4a01-9c01-000000000007",
      "name": "Тягач АТ-1000 Лайт",
      "solutionType": "tugger",
      "status": "needs_check",
      "score": 45.2,
      "checks": [
        {
          "rule": "aisle",
          "label": "Ширина прохода",
          "critical": true,
          "result": "unknown",
          "required": 3,
          "actual": null,
          "unit": "м",
          "message": "Нет данных о минимальной ширине прохода — запросите у производителя"
        },
        {
          "rule": "autonomy",
          "label": "Автономность",
          "critical": false,
          "result": "unknown",
          "required": 8,
          "actual": null,
          "unit": "ч",
          "message": "Время автономной работы не указано"
        }
        // …ещё 3 элемента
      ],
      "scoreBreakdown": [
        {
          "factor": "economy",
          "label": "Экономика (окупаемость)",
          "weight": 0.35,
          "value": 42,
          "contribution": 14.7
        },
        {
          "factor": "performance",
          "label": "Производительность",
          "weight": 0.25,
          "value": 62,
          "contribution": 15.5
        }
        // …ещё 3 элемента
      ],
      "missingData": [
        "Минимальная ширина прохода",
        "Время автономной работы"
        // …ещё 2 элемента
      ]
    }
    // …ещё 6 элементов (порядок: recommended → needs_check → excluded, внутри — по убыванию score)
  ],
  "scenarios": [
    {
      "id": "baseline",
      "kind": "baseline",
      "title": "Текущее состояние",
      "robotId": null,
      "equipment": [],
      "metrics": {
        "robotCount": {
          "label": "Количество роботов",
          "value": 0,
          "unit": "шт.",
          "formula": "⌈Целевая производительность / (Производительность робота × Загрузка × Готовность)⌉ × (1 + Резерв)",
          "overridden": false,
          "inputs": { "targetPerHour": 350, "utilization": 0.85, "availability": 0.95, "reserveShare": 0.1 }
        },
        "capexRub": {
          "label": "Капитальные затраты",
          "value": 0,
          "unit": "₽",
          "formula": "Сумма строк спецификации оборудования и работ",
          "overridden": false,
          "breakdown": []
        },
        "opexAnnualRub": {
          "label": "Операционные затраты в год",
          "value": 72960000,
          "unit": "₽/год",
          "formula": "ФОТ оставшегося персонала + обслуживание, энергия и ПО роботов",
          "overridden": false,
          "breakdown": [
            {
              "key": "labor",
              "label": "ФОТ оставшегося персонала",
              "value": 72960000,
              "source": "Параметры объекта"
            },
            {
              "key": "robots",
              "label": "Обслуживание, аренда, энергия, ПО",
              "value": 0,
              "source": "Каталог роботов"
            }
          ]
        },
        "opexDeltaRub": {
          "label": "Изменение операционных затрат",
          "value": 0,
          "unit": "₽/год",
          "formula": "OPEX сценария − OPEX текущего состояния",
          "overridden": false
        },
        "annualEffectRub": {
          "label": "Годовой эффект",
          "value": 0,
          "unit": "₽/год",
          "formula": "Экономия ФОТ − расходы на роботов",
          "overridden": false,
          "inputs": { "replacedStaff": 0, "laborSavingRub": 0, "robotOpexRub": 0 }
        },
        "paybackYears": {
          "label": "Срок окупаемости",
          "value": null,
          "unit": "лет",
          "formula": "Капитальные затраты / Годовой эффект",
          "overridden": false
        },
        "roiPercent": {
          "label": "ROI за горизонт расчёта",
          "value": null,
          "unit": "%",
          "formula": "(Годовой эффект × Горизонт − Капзатраты) / Капзатраты × 100 %",
          "overridden": false,
          "inputs": { "horizonYears": 5 }
        },
        "tcoRub": {
          "label": "Совокупная стоимость владения",
          "value": 364800000,
          "unit": "₽",
          "formula": "Капзатраты + OPEX × Горизонт расчёта",
          "overridden": false,
          "inputs": { "horizonYears": 5 }
        }
      },
      "cashflow": [
        { "year": 0, "capexRub": 0, "opexRub": 0, "effectRub": 0, "cumulativeRub": 0 },
        { "year": 1, "capexRub": 0, "opexRub": 72960000, "effectRub": 0, "cumulativeRub": 0 }
        // …ещё 4 элемента (годы 2…horizonYears)
      ],
      "verdict": {
        "level": "moderate",
        "label": "Текущее состояние",
        "interpretation": "Процессы выполняет персонал, инвестиций нет. Сценарий — точка отсчёта для сравнения.",
        "risks": ["Рост фонда оплаты труда", "Нехватка персонала в пиковые периоды"]
      }
    }
  ],
  "sensitivity": [],
  "assumptionsUsed": [
    {
      "key": "horizonYears",
      "label": "Горизонт расчёта",
      "value": 5,
      "unit": "лет",
      "source": "Параметры проекта",
      "confirmed": true
    },
    {
      "key": "utilization",
      "label": "Загрузка робота",
      "value": 85,
      "unit": "%",
      "source": "Демо-оценка по отраслевой практике",
      "confirmed": false
    }
    // …ещё 9 элементов
  ]
}
```

#### Пример 2. Пользователь, три сценария

Токен пользователя `user@demo.ru`, проект «Подольск». В сценарии покупки вручную задана
цена робота (`overrides.unitPriceRub`) — поэтому в ответе у `capexRub` стоит
`"overridden": true`. `overrides.robotCount: null` — число роботов считает сервер.

Запрос:

```jsonc
{
  "projectId": "c2d4e6f8-2222-4b02-9d02-000000000001",
  "objectType": "warehouse",
  "processes": ["internal_transport", "receiving"],
  "params": {
    "areaM2": 12000,
    "workMode": "2x8",
    "inboundPerDay": 1200,
    "internalPerDay": 2500,
    "outboundPerDay": 1800,
    "processPerfPerHour": 350,
    "storageType": "pallet_rack",
    "skuCount": 8500,
    "unitWeightKg": 350,
    "unitLengthM": 1.2,
    "unitWidthM": 0.8,
    "unitHeightM": 1.5,
    "staffCount": 64,
    "staffCostMonthRub": 95000,
    "avgRouteM": 120,
    "aisleWidthM": 3
  },
  "assumptions": {
    "horizonYears": 5,
    "workDaysPerYear": 250,
    "shiftsPerDay": 2,
    "hoursPerShift": 8,
    "utilization": 0.85,
    "availability": 0.95,
    "reserveShare": 0.1,
    "staffReplacedShare": 0.3
  },
  "scenarios": [
    { "id": "baseline", "kind": "baseline", "title": "Текущее состояние", "robotId": null },
    {
      "id": "purchase",
      "kind": "purchase",
      "title": "Покупка Логимов AMR-600",
      "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
      "overrides": { "robotCount": null, "unitPriceRub": 3900000 }
    },
    {
      "id": "raas",
      "kind": "raas",
      "title": "Аренда Логимов AMR-600 (RaaS)",
      "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
      "raas": { "monthlyFeePerRobotRub": 115000, "contractYears": 3, "setupRub": 4000000 }
    }
  ],
  "sensitivity": {
    "params": ["equipmentPrice", "operationsVolume", "laborCost"],
    "deltas": [-0.2, -0.1, 0.1, 0.2]
  },
  "simulation": {
    "engineVersion": "sim-1.0",
    "seed": 42,
    "throughputPerHour": 338,
    "targetPerHour": 350,
    "achievedPercent": 96.6,
    "avgUtilization": 0.78,
    "idleShare": 0.12,
    "chargingShare": 0.1,
    "maxQueue": 4,
    "bottleneck": "Зона приёмки: очередь на разгрузку в пиковый час",
    "confirmsCalculation": true
  }
}
```

Ответ **200 OK** — `CalcResult`. Пропущенные части имеют ту же структуру, что в примере 1:

```jsonc
{
  "calculationId": "a5aecb67-2562-4199-90f5-2aaf97bcba15",
  "modelVersion": "mock-1.0",
  "dataVersion": "catalog-2026.09",
  "calculatedAt": "2026-09-22T11:26:28.225Z",
  "disclaimer": "Предварительная оценка на основе введённых параметров и каталожных данных. Точность ±30 %. Не является инвестиционным решением: перед закупкой требуется обследование объекта и коммерческие предложения поставщиков.",
  "recommendation": [
    {
      "robotId": "b1f0a3c2-1111-4a01-9c01-000000000003",
      "name": "Автопогрузчик ФМР-16",
      "solutionType": "fmr",
      "status": "excluded",
      "score": null,
      "checks": [
        {
          "rule": "payload",
          "label": "Грузоподъёмность",
          "critical": true,
          "result": "pass",
          "required": 350,
          "actual": 1600,
          "unit": "кг",
          "message": "Грузоподъёмность 1 600 кг достаточна для единицы 350 кг"
        },
        {
          "rule": "aisle",
          "label": "Ширина прохода",
          "critical": true,
          "result": "fail",
          "required": 3,
          "actual": 3.2,
          "unit": "м",
          "message": "Роботу нужен проход 3,2 м, а на объекте только 3 м"
        }
        // …ещё 3 элемента
      ],
      "scoreBreakdown": [],
      "missingData": []
    }
    // …ещё 7 элементов (тот же подбор, что в примере гостя)
  ],
  "scenarios": [
    {
      "id": "purchase",
      "kind": "purchase",
      "title": "Покупка Логимов AMR-600",
      "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
      "equipment": [
        { "item": "Логимов AMR-600", "qty": 11, "unitPriceRub": 3900000, "totalRub": 42900000 },
        { "item": "Зарядная станция", "qty": 4, "unitPriceRub": 350000, "totalRub": 1400000 }
        // …ещё 2 элемента
      ],
      "metrics": {
        "robotCount": {
          "label": "Количество роботов",
          "value": 11,
          "unit": "шт.",
          "formula": "⌈Целевая производительность / (Производительность робота × Загрузка × Готовность)⌉ × (1 + Резерв)",
          "overridden": false,
          "inputs": { "targetPerHour": 350, "utilization": 0.85, "availability": 0.95, "reserveShare": 0.1 }
        },
        "capexRub": {
          "label": "Капитальные затраты",
          "value": 49600000,
          "unit": "₽",
          "formula": "Сумма строк спецификации оборудования и работ",
          "overridden": true,
          "breakdown": [
            { "key": "line1", "label": "Логимов AMR-600", "value": 42900000 },
            { "key": "line2", "label": "Зарядная станция", "value": 1400000 }
            // …ещё 2 элемента
          ]
        },
        "opexAnnualRub": {
          "label": "Операционные затраты в год",
          "value": 55604800,
          "unit": "₽/год",
          "formula": "ФОТ оставшегося персонала + обслуживание, энергия и ПО роботов",
          "overridden": false,
          "breakdown": [
            {
              "key": "labor",
              "label": "ФОТ оставшегося персонала",
              "value": 51300000,
              "source": "Параметры объекта"
            },
            {
              "key": "robots",
              "label": "Обслуживание, аренда, энергия, ПО",
              "value": 4304800,
              "source": "Каталог роботов"
            }
          ]
        },
        "opexDeltaRub": {
          "label": "Изменение операционных затрат",
          "value": -17355200,
          "unit": "₽/год",
          "formula": "OPEX сценария − OPEX текущего состояния",
          "overridden": false
        },
        "annualEffectRub": {
          "label": "Годовой эффект",
          "value": 17355200,
          "unit": "₽/год",
          "formula": "Экономия ФОТ − расходы на роботов",
          "overridden": false,
          "inputs": { "replacedStaff": 19, "laborSavingRub": 21660000, "robotOpexRub": 4304800 }
        },
        "paybackYears": {
          "label": "Срок окупаемости",
          "value": 2.86,
          "unit": "лет",
          "formula": "Капитальные затраты / Годовой эффект",
          "overridden": false
        },
        "roiPercent": {
          "label": "ROI за горизонт расчёта",
          "value": 75,
          "unit": "%",
          "formula": "(Годовой эффект × Горизонт − Капзатраты) / Капзатраты × 100 %",
          "overridden": false,
          "inputs": { "horizonYears": 5 }
        },
        "tcoRub": {
          "label": "Совокупная стоимость владения",
          "value": 327624000,
          "unit": "₽",
          "formula": "Капзатраты + OPEX × Горизонт расчёта",
          "overridden": false,
          "inputs": { "horizonYears": 5 }
        }
      },
      "cashflow": [
        { "year": 0, "capexRub": 49600000, "opexRub": 0, "effectRub": 0, "cumulativeRub": -49600000 },
        {
          "year": 1,
          "capexRub": 0,
          "opexRub": 55604800,
          "effectRub": 17355200,
          "cumulativeRub": -32244800
        }
        // …ещё 4 элемента (годы 2…horizonYears)
      ],
      "verdict": {
        "level": "good",
        "label": "Окупается быстро",
        "interpretation": "Срок окупаемости до 3 лет — проект привлекателен для пилотного внедрения.",
        "risks": ["Стоимость интеграции с WMS может отличаться после обследования"]
      }
    },
    {
      "id": "raas",
      "kind": "raas",
      "title": "Аренда Логимов AMR-600 (RaaS)",
      "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
      "equipment": [
        {
          "item": "Внедрение, интеграция и подготовка площадки (RaaS)",
          "qty": 1,
          "unitPriceRub": 4000000,
          "totalRub": 4000000
        }
      ],
      "metrics": {
        "robotCount": {
          "label": "Количество роботов",
          "value": 11,
          "unit": "шт.",
          "formula": "⌈Целевая производительность / (Производительность робота × Загрузка × Готовность)⌉ × (1 + Резерв)",
          "overridden": false,
          "inputs": { "targetPerHour": 350, "utilization": 0.85, "availability": 0.95, "reserveShare": 0.1 }
        },
        "capexRub": {
          "label": "Капитальные затраты",
          "value": 4000000,
          "unit": "₽",
          "formula": "Сумма строк спецификации оборудования и работ",
          "overridden": false,
          "breakdown": [
            {
              "key": "line1",
              "label": "Внедрение, интеграция и подготовка площадки (RaaS)",
              "value": 4000000
            }
          ]
        },
        "opexAnnualRub": {
          "label": "Операционные затраты в год",
          "value": 66664800,
          "unit": "₽/год",
          "formula": "ФОТ оставшегося персонала + обслуживание, энергия и ПО роботов",
          "overridden": false,
          "breakdown": [
            {
              "key": "labor",
              "label": "ФОТ оставшегося персонала",
              "value": 51300000,
              "source": "Параметры объекта"
            },
            {
              "key": "robots",
              "label": "Обслуживание, аренда, энергия, ПО",
              "value": 15364800,
              "source": "Каталог роботов"
            }
          ]
        },
        "opexDeltaRub": {
          "label": "Изменение операционных затрат",
          "value": -6295200,
          "unit": "₽/год",
          "formula": "OPEX сценария − OPEX текущего состояния",
          "overridden": false
        },
        "annualEffectRub": {
          "label": "Годовой эффект",
          "value": 6295200,
          "unit": "₽/год",
          "formula": "Экономия ФОТ − расходы на роботов",
          "overridden": false,
          "inputs": { "replacedStaff": 19, "laborSavingRub": 21660000, "robotOpexRub": 15364800 }
        },
        "paybackYears": {
          "label": "Срок окупаемости",
          "value": 0.64,
          "unit": "лет",
          "formula": "Капитальные затраты / Годовой эффект",
          "overridden": false
        },
        "roiPercent": {
          "label": "ROI за горизонт расчёта",
          "value": 686.9,
          "unit": "%",
          "formula": "(Годовой эффект × Горизонт − Капзатраты) / Капзатраты × 100 %",
          "overridden": false,
          "inputs": { "horizonYears": 5 }
        },
        "tcoRub": {
          "label": "Совокупная стоимость владения",
          "value": 337324000,
          "unit": "₽",
          "formula": "Капзатраты + OPEX × Горизонт расчёта",
          "overridden": false,
          "inputs": { "horizonYears": 5 }
        }
      },
      "cashflow": [
        { "year": 0, "capexRub": 4000000, "opexRub": 0, "effectRub": 0, "cumulativeRub": -4000000 },
        {
          "year": 1,
          "capexRub": 0,
          "opexRub": 66664800,
          "effectRub": 6295200,
          "cumulativeRub": 2295200
        }
        // …ещё 4 элемента (годы 2…horizonYears)
      ],
      "verdict": {
        "level": "good",
        "label": "Окупается быстро",
        "interpretation": "Срок окупаемости до 3 лет — проект привлекателен для пилотного внедрения.",
        "risks": [
          "Срок договора аренды короче горизонта расчёта — условия продления могут измениться"
        ]
      }
    }
    // …ещё 1 элемент (в ответе он первый — сценарий "baseline", структура как в примере гостя; порядок сценариев — как в запросе)
  ],
  "sensitivity": [
    {
      "scenarioId": "purchase",
      "param": "equipmentPrice",
      "label": "Стоимость оборудования",
      "points": [
        { "delta": -0.2, "paybackYears": 2.36, "roiPercent": 111.5, "annualEffectRub": 17355200 },
        { "delta": -0.1, "paybackYears": 2.61, "roiPercent": 91.5, "annualEffectRub": 17355200 }
        // …ещё 2 элемента (delta −0,1 … +0,2)
      ]
    }
    // …ещё 5 элементов (по 3 ряда — equipmentPrice, operationsVolume, laborCost — на сценарии purchase и raas)
  ],
  "assumptionsUsed": [
    {
      "key": "horizonYears",
      "label": "Горизонт расчёта",
      "value": 5,
      "unit": "лет",
      "source": "Параметры проекта",
      "confirmed": true
    },
    {
      "key": "utilization",
      "label": "Загрузка робота",
      "value": 85,
      "unit": "%",
      "source": "Демо-оценка по отраслевой практике",
      "confirmed": false
    }
    // …ещё 9 элементов
  ]
}
```

#### Ошибки POST /calculations

**400 VALIDATION_ERROR** — неизвестный `objectType`:

```jsonc
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "title": "Проверьте введённые данные",
  "errors": [
    { "field": "objectType", "message": "Выберите тип объекта из списка" }
  ]
}
```

**400 VALIDATION_ERROR** — у сценария `purchase` или `raas` не указан робот или его нет
в каталоге; `field` указывает на сценарий:

```jsonc
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "title": "Проверьте введённые данные",
  "errors": [
    { "field": "scenarios[0].robotId", "message": "Выберите робота для сценария «Покупка»" }
  ]
}
```

**422 CALCULATION_ERROR** — расчёт невозможен по данным. У робота не указана
производительность, и число роботов не задано вручную (`overrides.robotCount`):

```jsonc
{
  "status": 422,
  "code": "CALCULATION_ERROR",
  "title": "Для «ФМР-12 Узкопроходный» не указана производительность — задайте число роботов вручную"
}
```

У робота нет цены аренды, а в сценарии `raas` не передан `raas.monthlyFeePerRobotRub`:

```jsonc
{
  "status": 422,
  "code": "CALCULATION_ERROR",
  "title": "У «ФМР-12 Узкопроходный» нет цены аренды (RaaS) — укажите ежемесячную плату за робота"
}
```

**404 NOT_FOUND** — передан токен и `projectId`, но проекта нет или он чужой:

```jsonc
{ "status": 404, "code": "NOT_FOUND", "title": "Проект не найден — возможно, он был удалён" }
```

### GET /projects/{id}/calculations

История расчётов проекта, новые сверху. Доступ: владелец. Токен: нужен. Query-параметров нет.

Пример: `GET /api/v1/projects/c2d4e6f8-2222-4b02-9d02-000000000001/calculations`

Ответ **200 OK** — `CalculationSummary[]`. `bestPaybackYears` — наименьший срок окупаемости
среди сценариев расчёта или `null`:

```jsonc
[
  {
    "id": "a5aecb67-2562-4199-90f5-2aaf97bcba15",
    "createdAt": "2026-09-22T11:26:28.225Z",
    "modelVersion": "mock-1.0",
    "dataVersion": "catalog-2026.09",
    "bestPaybackYears": 0.64
  },
  {
    "id": "d3e5f7a9-3333-4c03-9e03-000000000001",
    "createdAt": "2026-09-15T12:10:00Z",
    "modelVersion": "mock-1.0",
    "dataVersion": "catalog-2026.09",
    "bestPaybackYears": 0.64
  }
]
```

Ошибки: **401 AUTH_REQUIRED**; **404 NOT_FOUND** — проекта нет или он чужой (тело как у
GET /projects/{id}).

### GET /calculations/{id}

Сохранённый расчёт: исходный запрос и результат — чтобы открыть его из истории без пересчёта.
Доступ: владелец. Токен: нужен.

Пример: `GET /api/v1/calculations/d3e5f7a9-3333-4c03-9e03-000000000001`

Ответ **200 OK** — `CalculationRecord`. `request` — ровно тот `CalcRequest`, что был
отправлен (включая `simulation`); `result` — тот же `CalcResult`, что вернул POST
/calculations, с `calculationId`, равным `id`. Массивы результата свёрнуты — их структура
показана в примерах POST /calculations:

```jsonc
{
  "id": "d3e5f7a9-3333-4c03-9e03-000000000001",
  "createdAt": "2026-09-15T12:10:00Z",
  "request": {
    "projectId": "c2d4e6f8-2222-4b02-9d02-000000000001",
    "objectType": "warehouse",
    "processes": ["internal_transport", "receiving"],
    "params": {
      "areaM2": 12000,
      "workMode": "2x8",
      "inboundPerDay": 1200,
      "internalPerDay": 2500,
      "outboundPerDay": 1800,
      "processPerfPerHour": 350,
      "storageType": "pallet_rack",
      "skuCount": 8500,
      "unitWeightKg": 350,
      "unitLengthM": 1.2,
      "unitWidthM": 0.8,
      "unitHeightM": 1.5,
      "staffCount": 64,
      "staffCostMonthRub": 95000,
      "avgRouteM": 120,
      "aisleWidthM": 3
    },
    "assumptions": {
      "horizonYears": 5,
      "workDaysPerYear": 250,
      "shiftsPerDay": 2,
      "hoursPerShift": 8,
      "utilization": 0.85,
      "availability": 0.95,
      "reserveShare": 0.1,
      "staffReplacedShare": 0.3
    },
    "scenarios": [
      { "id": "baseline", "kind": "baseline", "title": "Текущее состояние", "robotId": null },
      {
        "id": "purchase",
        "kind": "purchase",
        "title": "Покупка Логимов AMR-600",
        "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001"
      }
      // …ещё 1 элемент (сценарий "raas" — как в примере 2 POST /calculations)
    ],
    "sensitivity": {
      "params": ["equipmentPrice", "operationsVolume", "laborCost"],
      "deltas": [-0.2, -0.1, 0.1, 0.2]
    },
    "simulation": {
      "engineVersion": "sim-1.0",
      "seed": 42,
      "throughputPerHour": 338,
      "targetPerHour": 350,
      "achievedPercent": 96.6,
      "avgUtilization": 0.78,
      "idleShare": 0.12,
      "chargingShare": 0.1,
      "maxQueue": 4,
      "bottleneck": "Зона приёмки: очередь на разгрузку в пиковый час",
      "confirmsCalculation": true
    }
  },
  "result": {
    "calculationId": "d3e5f7a9-3333-4c03-9e03-000000000001",
    "modelVersion": "mock-1.0",
    "dataVersion": "catalog-2026.09",
    "calculatedAt": "2026-09-15T12:10:00Z",
    "disclaimer": "Предварительная оценка на основе введённых параметров и каталожных данных. Точность ±30 %. Не является инвестиционным решением: перед закупкой требуется обследование объекта и коммерческие предложения поставщиков.",
    "recommendation": [
      // 8 элементов (структура RecommendationItem — см. POST /calculations)
    ],
    "scenarios": [
      // 3 элемента (структура ScenarioResult — см. POST /calculations)
    ],
    "sensitivity": [
      // 6 элементов (структура SensitivitySeries — см. POST /calculations)
    ],
    "assumptionsUsed": [
      // 11 элементов (структура AssumptionRef — см. POST /calculations)
    ]
  }
}
```

Ошибки:

**401 AUTH_REQUIRED** — нет токена.

**404 NOT_FOUND** — расчёта нет или он чужой:

```jsonc
{ "status": 404, "code": "NOT_FOUND", "title": "Расчёт не найден — возможно, он был удалён" }
```

### GET /calculations/{id}/report.pdf

PDF-отчёт по сохранённому расчёту. Доступ: владелец. Токен: нужен.

Фронтенд скачивает файл запросом с заголовком `Authorization` (обычная ссылка заголовок не
передаёт), поэтому эндпоинт должен принимать токен из заголовка.

Пример: `GET /api/v1/calculations/d3e5f7a9-3333-4c03-9e03-000000000001/report.pdf`

Ответ **200 OK** — тело-файл, `Content-Type: application/pdf`. Желательно добавить
`Content-Disposition: attachment; filename="report-<id>.pdf"`. Мок отдаёт заглушку.

Ошибки — **в JSON**, как у GET /calculations/{id}: **401 AUTH_REQUIRED**, **404 NOT_FOUND**
(«Расчёт не найден — возможно, он был удалён»).

### GET /calculations/{id}/export.xlsx

Выгрузка расчёта в Excel. Доступ: владелец. Токен: нужен. Всё как у report.pdf, кроме
`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

Пример: `GET /api/v1/calculations/d3e5f7a9-3333-4c03-9e03-000000000001/export.xlsx`

Ответ **200 OK** — файл xlsx. Ошибки — в JSON: **401 AUTH_REQUIRED**, **404 NOT_FOUND**.
