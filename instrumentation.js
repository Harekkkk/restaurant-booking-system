const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

const sdk = new NodeSDK({
  serviceName: 'restaurant-booking-service',
  
  // Трейси (для Tempo)
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),

  // Метрики (для Prometheus/Grafana) - ЦЬОГО НЕ ВИСТАЧАЛО
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 5000,
  }),

  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log('Telemetry (Tracing + Metrics) initialized for restaurant-booking-service');
