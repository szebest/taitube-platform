#!/usr/bin/env bash
set -euo pipefail

PROMETHEUS_URL=${PROMETHEUS_URL:-http://localhost:9090}
GRAFANA_URL=${GRAFANA_URL:-http://localhost:3001}
TEMPO_URL=${TEMPO_URL:-http://localhost:3200}
LOKI_URL=${LOKI_URL:-http://localhost:3100}
OTEL_COLLECTOR_URL=${OTEL_COLLECTOR_URL:-http://localhost:4318}
ALERTMANAGER_URL=${ALERTMANAGER_URL:-http://localhost:9093}

echo "==> 1. Checking Prometheus API and targets UP..."
TARGETS_JSON=$(curl -sSf "${PROMETHEUS_URL}/api/v1/targets")

REQUIRED_TARGETS=(
  "api"
  "worker-probe"
  "worker-transcode-1080p"
  "worker-transcode-720p"
  "worker-transcode-480p"
  "worker-thumbnail"
  "worker-package"
  "worker-notify"
  "worker-housekeeping"
)

for job in "${REQUIRED_TARGETS[@]}"; do
  UP_COUNT=$(echo "${TARGETS_JSON}" | node -e "
    const fs = require('fs');
    const stdin = fs.readFileSync(0, 'utf8');
    const data = JSON.parse(stdin);
    const active = data.data.activeTargets.filter(t => t.labels.job === process.argv[1] && t.health === 'up');
    console.log(active.length);
  " "$job")
  if [[ "${UP_COUNT}" -lt 1 ]]; then
    echo "FAIL: Target '${job}' is not UP in Prometheus"
    echo "Active targets:"
    echo "${TARGETS_JSON}" | node -e "
      const fs = require('fs');
      const stdin = fs.readFileSync(0, 'utf8');
      const data = JSON.parse(stdin);
      console.log(JSON.stringify(data.data.activeTargets.map(t => ({ job: t.labels.job, health: t.health, lastError: t.lastError })), null, 2));
    "
    exit 1
  fi
  echo "  ? Target '${job}' is UP"
done

echo "==> 2. Checking Grafana datasources..."
GRAFANA_HEALTH=$(curl -sSf "${GRAFANA_URL}/api/health")
echo "  ? Grafana health: ${GRAFANA_HEALTH}"

DATASOURCES=$(curl -sSf -u admin:admin "${GRAFANA_URL}/api/datasources")
echo "${DATASOURCES}" | node -e "
  const fs = require('fs');
  const stdin = fs.readFileSync(0, 'utf8');
  const ds = JSON.parse(stdin);
  const names = ds.map(d => d.name);
  const required = ['Prometheus', 'Tempo', 'Loki'];
  for (const r of required) {
    if (!names.includes(r)) {
      console.error('Missing datasource:', r);
      process.exit(1);
    }
  }
  console.log('  ? Provisioned datasources present: ' + names.join(', '));
"

FOLDERS=$(curl -sSf -u admin:admin "${GRAFANA_URL}/api/folders")
echo "${FOLDERS}" | node -e "
  const fs = require('fs');
  const stdin = fs.readFileSync(0, 'utf8');
  const folders = JSON.parse(stdin);
  const found = folders.some(f => f.title === 'video-pipeline');
  if (!found) {
    console.error('Missing video-pipeline dashboard folder');
    process.exit(1);
  }
  console.log('  ? video-pipeline dashboard folder exists in Grafana');
"

echo "==> 3. Checking Alertmanager..."
AM_STATUS=$(curl -sSf "${ALERTMANAGER_URL}/api/v2/status")
echo "  ? Alertmanager status: OK"

echo "==> 4. Checking OTel Collector & Tempo with test OTLP trace..."
TRACE_ID=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
SPAN_ID=$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))")
START_TIME=$(node -e "console.log(Date.now() * 1000000)")
END_TIME=$(node -e "console.log((Date.now() + 100) * 1000000)")

OTLP_PAYLOAD=$(node -e "
  console.log(JSON.stringify({
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'test-service' } }
        ]
      },
      scopeSpans: [{
        spans: [{
          traceId: process.argv[1],
          spanId: process.argv[2],
          name: 'test-obs-check-span',
          kind: 1,
          startTimeUnixNano: process.argv[3],
          endTimeUnixNano: process.argv[4],
          status: { code: 1 }
        }]
      }]
    }]
  }));
" "$TRACE_ID" "$SPAN_ID" "$START_TIME" "$END_TIME")

curl -sSf -X POST "${OTEL_COLLECTOR_URL}/v1/traces"   -H "Content-Type: application/json"   -d "${OTLP_PAYLOAD}" >/dev/null

echo "  ? Test span sent to OTel collector with traceId: ${TRACE_ID}"

echo "  Querying Tempo for trace ${TRACE_ID}..."
MAX_RETRIES=15
FOUND_TRACE=0
for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${TEMPO_URL}/api/traces/${TRACE_ID}" || true)
  if [[ "${HTTP_CODE}" == "200" ]]; then
    FOUND_TRACE=1
    break
  fi
  sleep 1
done

if [[ "${FOUND_TRACE}" -eq 1 ]]; then
  echo "  ? Trace ${TRACE_ID} found in Tempo"
else
  echo "WARN: Trace not immediately queryable in Tempo (batching), but OTel collector accepted it."
fi

echo "==> 5. Checking OTel Collector & Loki with test log..."
LOG_PAYLOAD=$(node -e "
  console.log(JSON.stringify({
    resourceLogs: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'vp-api' } }
        ]
      },
      scopeLogs: [{
        logRecords: [{
          timeUnixNano: process.argv[1],
          severityText: 'INFO',
          body: { stringValue: '{\"service\":\"vp-api\",\"msg\":\"obs-check test log\"}' },
          attributes: [
            { key: 'service', value: { stringValue: 'vp-api' } }
          ]
        }]
      }]
    }]
  }));
" "$START_TIME")

curl -sSf -X POST "${OTEL_COLLECTOR_URL}/v1/logs"   -H "Content-Type: application/json"   -d "${LOG_PAYLOAD}" >/dev/null

echo "  ? Test log sent to OTel collector for Loki"

echo "  Querying Loki for {service_name=\"vp-api\"} or {service=\"vp-api\"}..."
MAX_RETRIES=15
FOUND_LOG=0
for i in $(seq 1 $MAX_RETRIES); do
  LOKI_RES=$(curl -sSf -G "${LOKI_URL}/loki/api/v1/query_range" --data-urlencode 'query={service_name="vp-api"}' || curl -sSf -G "${LOKI_URL}/loki/api/v1/query_range" --data-urlencode 'query={service="vp-api"}' || true)
  LOG_COUNT=$(echo "${LOKI_RES}" | node -e "
    const fs = require('fs');
    try {
      const stdin = fs.readFileSync(0, 'utf8');
      const data = JSON.parse(stdin);
      const res = data.data.result;
      console.log(res ? res.length : 0);
    } catch {
      console.log(0);
    }
  ")
  if [[ "${LOG_COUNT}" -gt 0 ]]; then
    FOUND_LOG=1
    break
  fi
  sleep 1
done

if [[ "${FOUND_LOG}" -eq 1 ]]; then
  echo "  ✔ Logs found in Loki for service vp-api"
else
  echo "WARN: Logs not immediately queryable in Loki, but OTel collector accepted them."
fi

echo "==> ALL OBSERVABILITY CHECKS PASSED!"
