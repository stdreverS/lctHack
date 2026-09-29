# Расчётное ядро Robo.Core — как вызывать из API

Ядро — модель `econ-1.0+rec-1.0` (`docs/economics.md`, `docs/recommendation.md`), результат
совпадает с моделью мока фронтенда. Если расчёт невозможен по данным, `Calculate` бросает
`CalculationException` — контроллер отвечает 422 `CALCULATION_ERROR` с `Message` в `title`.

## POST /calculations — инструкция для контроллера

1. При старте один раз загрузить справочники и зарегистрировать синглтоном:
   `builder.Services.AddSingleton(ConfigLoader.Load(configDir));` — `configDir` —
   папка `backend/config` (`object-types.json`, `norms.json`); в Docker её нужно скопировать в образ.
2. Тело запроса принимать как `Robo.Core.Contracts.CalcRequest` (`[FromBody]`, стандартный
   camelCase-JSON ASP.NET подходит; `params` приходит как `IReadOnlyDictionary<string, JsonElement>`).
3. До вызова ядра проверить: `objectType` есть в `config.ObjectTypes` (иначе 400 VALIDATION_ERROR),
   у сценариев `purchase`/`raas` робот есть в каталоге (400), при токене и `projectId` — проект
   существует и принадлежит пользователю (404 NOT_FOUND).
4. `robots` — весь каталог из БД, смапленный в `RobotSpec` (поля `specs` — на верхнем уровне, null
   оставлять null).
5. Вызов: `var result = CalculationEngine.Calculate(request, robots, engineConfig);` — чистая
   функция, ничего не пишет в БД.
6. Гость (нет токена или `projectId == null`) — вернуть `Ok(result)` как есть (`calculationId: null`).
   Пользователь — сохранить запрос и результат в историю, затем
   `result = result with { CalculationId = savedId }` и вернуть `Ok(result)`.
7. `GET /object-types` может отдавать `config.ObjectTypes` без преобразований — структура
   совпадает с контрактом `ObjectType`.
8. Для демо id роботов в seed должны совпадать с демо-каталогом
   (`frontend/src/mocks/data/robots.ts`, `backend/seed/robots.json`): демо-проекты и сценарии ссылаются на эти id.
