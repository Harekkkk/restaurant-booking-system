# Звіт до Практичної роботи №8: Observability

**Студент:** Склянчук Артем
**Сервіс:** Restaurant Booking System

## Рівень 60 балів: Запуск стенду
Успішно розгорнуто стек Grafana + Loki + Tempo + Prometheus через `docker-compose`.
Перевірено доступність:
* Grafana: http://localhost:3001
* Demo App: http://localhost:3000

## Рівень 75 балів: Власний RED-дашборд
Створено дашборд "My Demo RED" для моніторингу сервісу.
* **Файл дашборду:** [docs/my-demo-red-dashboard.json](./my-demo-red-dashboard.json)
* **Панелі:**
  1. **RPS:** `rate(http_server_requests_total[1m])`
  2. **Errors:** Відсоток 5xx кодів.
  3. **Latency (p95):** `histogram_quantile(0.95, ...)`
  4. **Logs:** Логи з Loki для `service_name="restaurant-booking-service"`.

## Рівень 90 балів: Підключення власного сервісу
До проєкту `restaurant-booking-system` додано бібліотеки OpenTelemetry.
* **Код інструментації:** Файл `instrumentation.js`.
* **Телеметрія:**
  * Трейси відправляються в Tempo (порт 4318).
  * Сервіс ідентифікується як `restaurant-booking-service`.

**[ТУТ ВСТАВ СКРІНШОТ З GRAFANA (TEMPO) ДЕ ВИДНО ВАШ СЕРВІС]**

## Рівень 100 балів: Алерти
Налаштовано правило алертингу в Grafana.

**Алерт: High Error Rate**
* **Умова:** Якщо кількість помилок 5xx перевищує 5% від загального трафіку протягом 5 хвилин.
* **Запит (PromQL):**
sum(rate(http_server_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_server_requests_total[5m])) > 0.05

* **Дія:** Відправка сповіщення в канал "DevOps Alerts" (імітація Webhook).
* **Користь:** Дозволяє миттєво дізнатися про критичні збої API до того, як поскаржаться користувачі.
