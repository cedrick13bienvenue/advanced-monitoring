#!/bin/bash

APP_URL="${APP_URL:-http://localhost:3000}"
DURATION="${DURATION:-780}"

echo "Load test starting — target: ${APP_URL} — duration: ${DURATION}s"
echo "This generates latency spikes (/api/slow) and errors (/api/error)"
echo "Alerts require 10m of sustained breach — script runs for 13m"
echo "--------------------------------------------------------------"

END=$((SECONDS + DURATION))

while [ $SECONDS -lt $END ]; do
  curl -s "${APP_URL}/"          > /dev/null
  curl -s "${APP_URL}/api/items" > /dev/null
  curl -s "${APP_URL}/health"    > /dev/null

  curl -s "${APP_URL}/api/slow"  > /dev/null

  curl -s "${APP_URL}/api/error" > /dev/null
  curl -s "${APP_URL}/api/error" > /dev/null
  curl -s "${APP_URL}/api/error" > /dev/null

  REMAINING=$((END - SECONDS))
  echo "[$(date '+%H:%M:%S')] batch sent — ${REMAINING}s remaining"
  sleep 1
done

echo "--------------------------------------------------------------"
echo "Load test complete. Check Prometheus alerts and Grafana now."
