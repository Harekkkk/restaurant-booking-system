const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  serviceName: 'restaurant-booking-service', 
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log('Tracing initialized for restaurant-booking-service');
