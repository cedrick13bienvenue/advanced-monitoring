'use strict';

const { NodeSDK }                    = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter }          = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource }                   = require('@opentelemetry/resources');

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318/v1/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name':    process.env.OTEL_SERVICE_NAME || 'node-app',
    'service.version': process.env.APP_VERSION       || '1.0.0',
    'deployment.environment': process.env.NODE_ENV   || 'production',
  }),
  traceExporter: exporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
