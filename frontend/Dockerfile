# Демо-сборка фронтенда: данные отдают моки в браузере (VITE_USE_MOCKS=true), сервер не нужен.
# Когда появится бэкенд, соберите с --build-arg VITE_USE_MOCKS=false и включите прокси /api в nginx.conf.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_USE_MOCKS=true
# Переменная окружения важнее .env.production — так в сборку попадает режим моков
ENV VITE_USE_MOCKS=${VITE_USE_MOCKS}
# build = проверка типов + сборка Vite
RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
