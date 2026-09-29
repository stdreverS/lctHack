# Библиотеки и источники данных

Документ для п. 6.8 ТЗ. Версии — установленные по `frontend/package-lock.json` и указанные в
`.csproj`. Лицензии — из метаданных пакетов.

## Фронтенд: зависимости сборки приложения (`frontend/package.json`, `dependencies`)

| Пакет | Версия | Лицензия | Для чего | Ссылка |
|---|---|---|---|---|
| vue | 3.5.43 | MIT | Фреймворк интерфейса | <https://www.npmjs.com/package/vue> |
| vue-router | 5.3.1 | MIT | Маршруты, защита разделов по ролям | <https://www.npmjs.com/package/vue-router> |
| pinia | 4.0.3 | MIT | Хранилища состояния: авторизация, мастер | <https://www.npmjs.com/package/pinia> |
| element-plus | 2.14.6 | MIT | Компоненты интерфейса, локаль ru | <https://www.npmjs.com/package/element-plus> |
| @element-plus/icons-vue | 2.3.2 | MIT | Иконки | <https://www.npmjs.com/package/@element-plus/icons-vue> |
| chart.js | 4.5.1 | MIT | Графики: денежный поток, чувствительность, очередь | <https://www.npmjs.com/package/chart.js> |
| vue-chartjs | 5.3.4 | MIT | Компоненты Vue для Chart.js | <https://www.npmjs.com/package/vue-chartjs> |
| papaparse | 5.7.0 | MIT | Разбор CSV с параметрами объекта | <https://www.npmjs.com/package/papaparse> |
| @fontsource/golos-text | 5.3.0 | OFL-1.1 | Шрифт Golos Text локально, без CDN | <https://www.npmjs.com/package/@fontsource/golos-text> |

## Фронтенд: инструменты разработки (`devDependencies`)

| Пакет | Версия | Лицензия | Для чего | Ссылка |
|---|---|---|---|---|
| vite | 8.3.0 | MIT | Сборка и dev-сервер | <https://www.npmjs.com/package/vite> |
| @vitejs/plugin-vue | 6.0.9 | MIT | Однофайловые компоненты Vue в Vite | <https://www.npmjs.com/package/@vitejs/plugin-vue> |
| vite-plugin-vue-devtools | 8.2.1 | MIT | Инструменты разработчика Vue (только dev-сервер) | <https://www.npmjs.com/package/vite-plugin-vue-devtools> |
| typescript | 6.0.3 | Apache-2.0 | Язык, проверка типов | <https://www.npmjs.com/package/typescript> |
| vue-tsc | 3.3.11 | MIT | Проверка типов в `.vue` (`npm run type-check`) | <https://www.npmjs.com/package/vue-tsc> |
| vitest | 5.0.1 | MIT | Модульные тесты | <https://www.npmjs.com/package/vitest> |
| npm-run-all2 | 9.0.3 | MIT | Параллельный запуск проверки типов и сборки | <https://www.npmjs.com/package/npm-run-all2> |
| @tsconfig/node24 | 24.0.5 | MIT | Базовый tsconfig для Node 24 | <https://www.npmjs.com/package/@tsconfig/node24> |
| @vue/tsconfig | 0.9.1 | MIT | Базовый tsconfig для Vue | <https://www.npmjs.com/package/@vue/tsconfig> |
| @types/node | 24.13.6 | MIT | Типы Node.js | <https://www.npmjs.com/package/@types/node> |
| @types/papaparse | 5.5.2 | MIT | Типы PapaParse | <https://www.npmjs.com/package/@types/papaparse> |

## Бэкенд (.NET 10)

| Пакет | Версия | Проект | Для чего | Ссылка |
|---|---|---|---|---|
| BCrypt.Net-Next | 4.2.0 | Robo.Api | Хэширование паролей (BCrypt) | <https://www.nuget.org/packages/BCrypt.Net-Next> |
| ClosedXML | 0.105.1 | Robo.Api | Выгрузка расчёта в Excel | <https://www.nuget.org/packages/ClosedXML> |
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.12 | Robo.Api | JWT-авторизация | <https://www.nuget.org/packages/Microsoft.AspNetCore.Authentication.JwtBearer> |
| System.IdentityModel.Tokens.Jwt | 8.23.0 | Robo.Api | Выпуск JWT-токенов | <https://www.nuget.org/packages/System.IdentityModel.Tokens.Jwt> |
| Microsoft.AspNetCore.OpenApi | 10.0.12 | Robo.Api | Спецификация OpenAPI (`/openapi/v1.json`) | <https://www.nuget.org/packages/Microsoft.AspNetCore.OpenApi> |
| Swashbuckle.AspNetCore.SwaggerUI | 10.2.3 | Robo.Api | Swagger UI (`/swagger`) | <https://www.nuget.org/packages/Swashbuckle.AspNetCore.SwaggerUI> |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.3 | Robo.Api | EF Core для PostgreSQL | <https://www.nuget.org/packages/Npgsql.EntityFrameworkCore.PostgreSQL> |
| Microsoft.EntityFrameworkCore.Relational | 10.0.12 | Robo.Api | EF Core: миграции, единая версия для всех проектов | <https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Relational> |
| Microsoft.EntityFrameworkCore.Design | 10.0.12 | Robo.Api | Инструменты миграций EF Core (только разработка) | <https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Design> |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.12 | Robo.Tests | Тесты API на `WebApplicationFactory` | <https://www.nuget.org/packages/Microsoft.AspNetCore.Mvc.Testing> |
| Microsoft.EntityFrameworkCore.InMemory | 10.0.12 | Robo.Tests | База в памяти для тестов API | <https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.InMemory> |
| xunit | 2.9.3 | Robo.Tests | Модульные тесты | <https://www.nuget.org/packages/xunit> |
| xunit.runner.visualstudio | 3.1.4 | Robo.Tests | Запуск тестов xUnit | <https://www.nuget.org/packages/xunit.runner.visualstudio> |
| Microsoft.NET.Test.Sdk | 17.14.1 | Robo.Tests | Инфраструктура `dotnet test` | <https://www.nuget.org/packages/Microsoft.NET.Test.Sdk> |
| coverlet.collector | 6.0.4 | Robo.Tests | Сбор покрытия тестами | <https://www.nuget.org/packages/coverlet.collector> |
| dotnet-ef | 10.0.12 | локальный инструмент (`backend/dotnet-tools.json`) | Создание миграций | <https://www.nuget.org/packages/dotnet-ef> |

`Robo.Core` внешних пакетов не использует (только стандартная библиотека .NET, в том числе
System.Text.Json).

## Образы Docker

| Образ | Для чего | Ссылка |
|---|---|---|
| node:24-alpine | Сборка фронтенда (`frontend/Dockerfile`) | <https://hub.docker.com/_/node> |
| nginx:stable-alpine | Раздача фронтенда и прокси `/api/` (сервис `web`) | <https://hub.docker.com/_/nginx> |
| mcr.microsoft.com/dotnet/sdk:10.0 | Сборка API (`backend/Dockerfile`) | <https://mcr.microsoft.com/product/dotnet/sdk> |
| mcr.microsoft.com/dotnet/aspnet:10.0 | Запуск API (сервис `api`) | <https://mcr.microsoft.com/product/dotnet/aspnet> |
| postgres:17-alpine | База данных (сервис `db`) | <https://hub.docker.com/_/postgres> |

## Источники данных

| Источник | Где используется |
|---|---|
| Техническое задание хакатона ФЦ БАС и «Дополнения для участников» | Требования, состав параметров объектов (п. 3.2.1), определения CAPEX, OPEX, RaaS |
| Трудовой кодекс РФ, ст. 91 | Длительность смены 8 ч по умолчанию |
| ГОСТ 33757-2016 | Размеры поддона 1200×800 мм — длина и ширина грузовой единицы склада по умолчанию |
| СП 158.13330.2014 | Ширина коридоров больницы по умолчанию |
| Демо-оценки команды | Каталог роботов, демо-параметры объектов, коэффициенты модели (`docs/economics.md`) |

Каталог роботов — вымышленный (ссылки на `example.com`); открытые источники производителей
не использовались.

## Ограничения

- Лицензии указаны по метаданным пакетов, юридическая проверка не проводилась.
- Транзитивные зависимости не перечислены — полный список в `frontend/package-lock.json` и
  выводе `dotnet list package --include-transitive`.
- Нормативные документы указаны так, как они записаны в данных проекта; соответствие значений
  их актуальным редакциям не перепроверялось.
