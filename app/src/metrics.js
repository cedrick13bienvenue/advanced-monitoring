'use strict';

const client  = require('prom-client');
const { trace } = require('@opentelemetry/api');

const register = new client.Registry();

client.collectDefaultMetrics({ register, prefix: 'node_app_' });

const httpRequestsTotal = new client.Counter({
  name:       'http_requests_total',
  help:       'Total HTTP requests partitioned by method, route, and status code.',
  labelNames: ['method', 'route', 'status_code'],
  registers:  [register],
});

const httpRequestDuration = new client.Histogram({
  name:            'http_request_duration_seconds',
  help:            'HTTP request latency in seconds.',
  labelNames:      ['method', 'route', 'status_code'],
  buckets:         [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers:       [register],
  enableExemplars: true,
});

function metricsMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const route  = req.route ? req.route.path : req.path;
    const labels = {
      method:      req.method,
      route,
      status_code: String(res.statusCode),
    };
    const durationSec = Number(process.hrtime.bigint() - startNs) / 1e9;

    const span    = trace.getActiveSpan();
    const traceId = span ? span.spanContext().traceId : null;

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(
      labels,
      durationSec,
      traceId ? { traceId } : undefined
    );
  });

  next();
}

module.exports = { register, metricsMiddleware };
