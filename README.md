# Advanced Observability & Distributed Tracing

## Overview

This lab solves a problem that metrics and logs alone cannot: **when your app is slow, which exact request caused it, which line of code ran, and how long each step took — with a single click from a Grafana graph.**

Project 6 gave you metrics (numbers over time) and logs (text events). But when a latency spike hits at 2am, metrics tell you *that* something is broken, logs tell you *what happened*, but neither tells you *why* a specific request was slow. That gap is **distributed tracing**.

This project extends the containerised Node.js/Express app with three new capabilities:

- **OpenTelemetry SDK** instruments every HTTP request automatically — no manual span creation per route. Every inbound request gets a trace with child spans for each middleware layer, measuring exact timing per step.
- **Jaeger** receives and stores those traces, giving you a searchable UI where you can find any request by service, operation, duration, or trace ID.
- **Prometheus Exemplars** embed a `traceId` inside histogram metric samples. Grafana reads them and renders clickable diamond markers on the latency graph — click a spike, land on the exact Jaeger trace that caused it.

The result is a three-way correlation: a Grafana alert fires → you click an exemplar diamond → Jaeger shows the exact slow span → you copy the `trace_id` → logs show every log line for that request. **Symptom to root cause in three clicks.**

---

## Objectives

- Add OpenTelemetry SDK with auto-instrumentation to an existing Express app — zero manual span creation
- Export traces to Jaeger via OTLP HTTP on port 4318
- Inject `trace_id` and `span_id` into every structured JSON log line via `AsyncLocalStorage`
- Enable Prometheus exemplars on the latency histogram — embed `traceId` and `spanId` in metric samples
- Provision Jaeger datasource in Grafana and wire `exemplarTraceIdDestinations` to create metric→trace links
- Tighten alert thresholds: p95 latency > 300ms and error rate > 5% both sustained for 10 minutes
- Validate with a sustained load test: alert fires → exemplar clicked → trace found → log correlated

---

## Tools & Versions

| Tool | Version |
|---|---|
| Node.js | 18-alpine |
| Express | 4.18.2 |
| prom-client | 15.1.0 |
| @opentelemetry/sdk-node | ^0.57.0 |
| @opentelemetry/auto-instrumentations-node | ^0.57.0 |
| @opentelemetry/exporter-trace-otlp-http | ^0.57.0 |
| Prometheus | v2.51.0 |
| Grafana | 10.4.0 |
| Jaeger | 1.57 (all-in-one) |
| Node Exporter | v1.7.0 |
| Docker Compose | v2 |
| OS (local) | macOS |

---

## Problem This Lab Solves

Running a containerised app with only metrics and logs leaves a critical gap:

- **Metrics show symptoms, not causes** — p95 latency at 500ms tells you something is slow, not which request or which code path
- **Logs show events, not timing** — a log line at 14:32:01 shows an error happened, not that it was step 3 of 5 that took 490ms
- **No request-level correlation** — you cannot connect a Grafana alert to a specific log line without manually searching by timestamp
- **Manual trace hunting** — without trace IDs in logs, finding the relevant request in thousands of log lines is guesswork

OpenTelemetry + Jaeger + Prometheus Exemplars eliminates all four. Every request gets a `trace_id` that flows through spans, metrics, and log lines — one ID connects all three observability pillars.

---

## Architecture

```
YOUR MACHINE — Docker Compose
│
├── node-app (port 3000)
│   ├── tracing.js  ← OTel SDK starts here, patches http before Express loads
│   ├── logger.js   ← reads active span via AsyncLocalStorage, injects trace_id/span_id
│   ├── metrics.js  ← Histogram with enableExemplars, observes {traceId, spanId}
│   └── app.js      ← Express routes with structured JSON logging on every request
│         │
│         │  OTLP HTTP  (spans pushed to Jaeger port 4318)
│         ▼
├── jaeger (ports 16686 UI / 4317 gRPC / 4318 HTTP)
│   └── all-in-one: collector + query + UI + in-memory store
│         │
│         │  Jaeger datasource (uid: jaeger)
│         ▼
├── grafana (port 3001)
│   ├── Prometheus datasource — exemplarTraceIdDestinations → jaeger uid
│   └── Dashboard: RED metrics + Latency Exemplars + Jaeger traces panel
│         ▲
│         │  scrapes /metrics every 15s (exemplar-storage enabled)
├── prometheus (port 9090)
│   ├── --enable-feature=exemplar-storage
│   ├── alert_rules.yml — HighErrorRate >5% / HighLatency p95>300ms / AppDown
│   └── scrapes: node-app:3000 / node-exporter:9100 / localhost:9090
│
└── node-exporter (port 9100)
      └── host CPU, memory, disk, network metrics

Correlation flow:
  Grafana alert (metric spike)
    → click exemplar diamond ◆ on latency graph
    → Jaeger trace (exact request, all spans, per-step timing)
    → copy trace_id → search docker logs
    → log lines for that exact request
```

---

## Project Structure

```
advanced-monitoring/
├── app/
│   ├── src/
│   │   ├── server.js     # Entry point — requires tracing.js FIRST before anything else
│   │   ├── tracing.js    # OTel NodeSDK + OTLP exporter + auto-instrumentations
│   │   ├── logger.js     # Structured JSON logger — injects trace_id + span_id per line
│   │   ├── metrics.js    # prom-client OpenMetrics registry + exemplar-enabled histogram
│   │   └── app.js        # Express routes: /, /health, /api/items, /api/slow, /api/error
│   ├── Dockerfile        # Multi-stage build, COPY --chown (no RUN chown -R), non-root user
│   └── package.json      # OTel SDK + prom-client + Express dependencies
├── prometheus/
│   ├── prometheus.yml    # Scrape config — 15s interval, three jobs
│   └── alert_rules.yml   # HighErrorRate >5% 10m / HighLatency p95>300ms 10m / AppDown 1m
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml  # Prometheus (with exemplarTraceIdDestinations) + Jaeger
│   │   └── dashboards/
│   │       └── dashboard.yml    # File-based dashboard provisioner
│   └── dashboards/
│       └── app-dashboard.json   # RED metrics + exemplars panel + Jaeger traces panel
├── docker-compose.yml    # 5 services: app, jaeger, prometheus, grafana, node-exporter
├── load-test.sh          # 13-minute load generator — triggers both alert thresholds
├── .env.example          # Copy to .env before first run
├── .gitignore
└── screenshots/          # 18 screenshots documenting the full validation workflow
```
