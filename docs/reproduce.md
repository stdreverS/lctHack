# Воспроизведение демонстрационного расчёта

Документ для п. 6.10 ТЗ: как стороннему специалисту развернуть решение и получить
демонстрационный расчёт с теми же числами.

## 1. Развернуть

```bash
git clone <репозиторий> && cd robo-platform
cp .env.example .env            # задайте POSTGRES_PASSWORD и JWT_SECRET (не короче 32 символов)
docker compose up -d --build    # web, api, db
```

Приложение — <http://localhost:8080>. Требования, переменные окружения и запуск без Docker —
`docs/deployment.md`, `README.md`.

## 2. Повторить расчёт в интерфейсе

1. Главная → «Попробовать без регистрации» (`/demo`).
2. Шаг 1: «Склад», все пять процессов, способ заполнения — «Демо-данные».
3. Шаг 2: параметры не менять (площадь 12 000 м², 1 200 / 2 500 / 1 800 операций в сутки,
   350 опер./ч, груз 350 кг, 64 сотрудника по 95 000 ₽/мес, проходы 3 м).
4. Шаг 3: отметить «Логимов AMR-600» для сравнения.
5. Шаг 4: «Логимов AMR-600» для сценариев «Покупка» и «Роботы как услуга (RaaS)».
6. Шаг 5: условия аренды по умолчанию — 115 000 ₽ в месяц за робота, договор 3 года,
   внедрение 1 500 000 ₽.

## 3. Ожидаемый результат

Модель `econ-1.0+rec-1.0`, данные `catalog-2026.09`, допущения по умолчанию: горизонт 5 лет,
250 рабочих дней, 2 смены по 8 ч, загрузка 85 %, готовность 95 %, резерв 10 %, доля
замещаемого персонала 30 %.

| Показатель | Покупка | Роботы как услуга |
|---|---|---|
| Число роботов | 15 | 15 |
| Капитальные затраты | 70 050 000 ₽ | 1 500 000 ₽ |
| Годовой эффект | 16 008 000 ₽/год | 708 000 ₽/год |
| Срок окупаемости | 4,4 года (4,38) | 2,1 года (2,12) |
| ROI за 5 лет | 114,3 % | 236 % |
| Вывод | Умеренная окупаемость | Окупается быстро |

Подбор: «Логимов AMR-600» — «Рекомендовано», балл 74,4. Шаг 7 (сценарий «Покупка»): выполнено
95 % цели при загрузке роботов 63,1 % — «Расчёт подтверждён». Полный отчёт с этими числами —
`docs/example-report.pdf`; формулы и пошаговый расчёт — `docs/economics.md`, раздел «Пример».

## 4. Повторить расчёт через API

Тот же расчёт без интерфейса (гость, без сохранения):

```bash
curl -s -X POST http://localhost:8080/api/v1/calculations -H 'Content-Type: application/json' -d '{
  "projectId": null, "objectType": "warehouse",
  "processes": ["receiving", "internal_transport", "picking", "shipping", "cleaning"],
  "params": {"areaM2": 12000, "workMode": "2x8", "inboundPerDay": 1200, "internalPerDay": 2500,
    "outboundPerDay": 1800, "processPerfPerHour": 350, "storageType": "pallet_rack", "skuCount": 8500,
    "unitWeightKg": 350, "unitLengthM": 1.2, "unitWidthM": 0.8, "unitHeightM": 1.5, "staffCount": 64,
    "staffCostMonthRub": 95000, "avgRouteM": 120, "aisleWidthM": 3},
  "assumptions": {"horizonYears": 5, "workDaysPerYear": 250, "shiftsPerDay": 2, "hoursPerShift": 8,
    "utilization": 0.85, "availability": 0.95, "reserveShare": 0.1, "staffReplacedShare": 0.3},
  "scenarios": [
    {"id": "baseline", "kind": "baseline", "title": "Текущее состояние", "robotId": null},
    {"id": "purchase", "kind": "purchase", "title": "Покупка", "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001"},
    {"id": "raas", "kind": "raas", "title": "Роботы как услуга (RaaS)", "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
     "raas": {"monthlyFeePerRobotRub": 115000, "contractYears": 3, "setupRub": 1500000}}],
  "sensitivity": {"params": ["equipmentPrice", "operationsVolume", "laborCost"], "deltas": [-0.2, -0.1, 0.1, 0.2]}
}'
```

В ответе `scenarios[1].metrics`: `robotCount` 15, `capexRub` 70050000, `paybackYears` 4.38,
`roiPercent` 114.3; `scenarios[2].metrics`: `paybackYears` 2.12, `roiPercent` 236.

## 5. Автоматическая проверка

```bash
cd backend && dotnet test Robo.slnx        # в т. ч. эталонные расчёты GoldenCalculationTests
cd frontend && npx vitest run               # в т. ч. эталон модели мока golden.test.ts
```

Эталонные тесты сравнивают ответ ядра с пятью заранее посчитанными расчётами целиком, включая
демо-склад выше (`docs/economics.md`, «Где считается»).
