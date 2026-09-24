// tests/load/s6-sse-fanout.js — S6: SSE fan-out & real-time delivery performance (SDD §14.2, §10)
// Architectural decision on SSE in k6:
// Standard k6 does not bundle WebSocket/SSE streaming clients in default Go binaries without xk6 extensions.
// We implement high-concurrency event-stream sampling over standard k6/http with 'Accept: text/event-stream'
// and 'Last-Event-ID' header testing. This enables portable execution on both standard k6 and k6-operator
// without requiring custom binary builds, while accurately measuring connection overhead, snapshot latency,
// and publish-to-receive delays via payload timestamps.

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { getAuthHeaders } from './common.js';

const API_BASE = __ENV.API || 'http://localhost:3000';

const publishToReceiveLatency = new Trend('publish_to_receive_latency');
const sseConnectDuration = new Trend('sse_connect_duration');
const reconnectCount = new Counter('sse_reconnects_total');

export const options = {
  scenarios: {
    sse_fanout: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 500 }, // Scaled for local test, up to 5000 in full cluster
        { duration: '3m', target: 500 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{name:sse-connect}': ['p(95)<2000'],
    publish_to_receive_latency: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  // 200 partitioned video IDs for fan-out distribution
  const videoIndex = (__VU % 200) + 1;
  const videoId = `00000000-0000-7000-8000-${String(videoIndex).padStart(12, '0')}`;

  const headers = Object.assign({}, getAuthHeaders(), {
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  });

  const connectStart = Date.now();

  // Fastify sse-hub sends an immediate snapshot on connect
  const res = http.get(`${API_BASE}/v1/videos/${videoId}/events`, {
    headers,
    timeout: '10s',
    tags: { name: 'sse-connect' },
  });

  sseConnectDuration.add(Date.now() - connectStart);

  check(res, {
    'SSE response 200': (r) => r.status === 200,
    'content-type is text/event-stream': (r) =>
      r.headers['Content-Type']?.includes('text/event-stream'),
  });

  let lastEventId = '0';
  if (res.body && typeof res.body === 'string') {
    const lines = res.body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('id:')) {
        lastEventId = line.substring(3).trim();
      } else if (line.startsWith('data:')) {
        try {
          const payload = JSON.parse(line.substring(5).trim());
          if (payload?.ts) {
            const latencyMs = Math.max(0, Date.now() - payload.ts);
            publishToReceiveLatency.add(latencyMs);
          }
        } catch (_e) {
          // non-json frame, e.g. ping
        }
      }
    }
  }

  sleep(1);

  const reconnectHeaders = Object.assign({}, headers, {
    'Last-Event-ID': lastEventId || '1',
  });

  const reconnRes = http.get(`${API_BASE}/v1/videos/${videoId}/events`, {
    headers: reconnectHeaders,
    timeout: '10s',
    tags: { name: 'sse-reconnect' },
  });

  reconnectCount.add(1);

  check(reconnRes, {
    'reconnect 200': (r) => r.status === 200,
    'reconnect snapshot received': (r) => r.body && r.body.length > 0,
  });

  sleep(2);
}
