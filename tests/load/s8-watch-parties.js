// tests/load/s8-watch-parties.js — S8: watch party rooms over two API replicas (SDD §14.2)
//
// 200 rooms of 25 members (a fifth of them guests) and one room at the 200 member ceiling: 5 200 sockets.
// Every member pings the clock and chats about every 30 s and reacts in bursts. The first member of a room
// is its controller: it sends a command every 20 s and flips playback.control on Member once a minute.
//
// Latencies are measured on the receiving side against the server's clock: each member keeps the offset of
// its last clock round trip, so a `state` frame is as old as (now + offset) - playback.anchorAt, and a
// `roles` frame as old as (now + offset) - the Member role's updatedAt. Fan-out p95 and API RSS are read
// from Prometheus by the `verify` scenario once the load has ended.
//
// Run: make load-s8 (see the target for the compose setup, the token file and the replicas).

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { WebSocket } from 'k6/websockets';

const API_URLS = (__ENV.API_URLS || 'http://localhost:3000,http://localhost:3001').split(',');
const PROM = __ENV.PROM_URL || 'http://localhost:9090';
const ROOMS = Number(__ENV.ROOMS || 200);
const ROOM_SIZE = Number(__ENV.ROOM_SIZE || 25);
const CEILING = Number(__ENV.CEILING || 200);
const DURATION_S = Number(__ENV.DURATION_S || 600);
const TOKENS = JSON.parse(open(__ENV.TOKENS_FILE || './s8-tokens.json'));
const MEMBERS = ROOMS * ROOM_SIZE + CEILING;

const stateLatency = new Trend('s8_command_to_state_ms', true);
const rolesLatency = new Trend('s8_role_change_to_roles_ms', true);
const fanoutP95 = new Trend('s8_fanout_p95_ms');
const apiRssMb = new Trend('s8_api_rss_mb');
const socketErrors = new Rate('s8_socket_errors');
const unexpectedFrames = new Counter('s8_unexpected_frames');

export const options = {
  scenarios: {
    members: {
      executor: 'per-vu-iterations',
      vus: MEMBERS,
      iterations: 1,
      maxDuration: `${DURATION_S + 300}s`,
      exec: 'member',
    },
    verify: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      startTime: `${DURATION_S + 30}s`,
      exec: 'verify',
    },
  },
  thresholds: {
    s8_command_to_state_ms: ['p(95)<250'],
    s8_role_change_to_roles_ms: ['p(95)<250'],
    s8_fanout_p95_ms: ['max<150'],
    s8_socket_errors: ['rate<0.001'],
    s8_api_rss_mb: ['max<768'],
    s8_unexpected_frames: ['count==0'],
    checks: ['rate>0.99'],
  },
};

const json = { 'Content-Type': 'application/json' };

function bearer(token) {
  return Object.assign({ Authorization: `Bearer ${token}` }, json);
}

/** A distinct private address per VU, which the compose API trusts (TRUST_PROXY=uniquelocal) as the caller's. */
function forwardedFor(vu) {
  return `10.${(vu >> 16) & 255}.${(vu >> 8) & 255}.${vu & 255}`;
}

export function setup() {
  const rooms = [];
  for (let room = 0; room <= ROOMS; room += 1) {
    const owner = TOKENS[room * ROOM_SIZE];
    const created = http.post(
      `${API_URLS[0]}/v1/watch-parties`,
      JSON.stringify({
        visibility: 'unlisted',
        preset: 'friends',
        hostAs: 'user',
        allowGuests: true,
        name: room === ROOMS ? 's8 ceiling room' : `s8 room ${room}`,
      }),
      { headers: bearer(owner) }
    );
    check(created, { 'room created': (r) => r.status === 201 });
    rooms.push(created.json('id'));
  }
  return { rooms };
}

function placeOf(vu) {
  const index = vu - 1;
  if (index >= ROOMS * ROOM_SIZE) return { room: ROOMS, seat: index - ROOMS * ROOM_SIZE };
  return { room: Math.floor(index / ROOM_SIZE), seat: index % ROOM_SIZE };
}

/** Tokens run room by room, then the ceiling room's, so seat 0 of every room holds its owner's. */
function tokenOf(vu) {
  const { room, seat } = placeOf(vu);
  return TOKENS[room === ROOMS ? ROOMS * ROOM_SIZE + seat : room * ROOM_SIZE + seat];
}

function joinAs(base, roomId, vu, guest) {
  if (!guest) {
    const joined = http.post(`${base}/v1/watch-parties/${roomId}/join`, '{}', {
      headers: bearer(tokenOf(vu)),
    });
    check(joined, { 'member joined': (r) => r.status === 200 || r.status === 201 });
    return bearer(tokenOf(vu));
  }
  const joined = http.post(`${base}/v1/watch-parties/${roomId}/guest`, '{}', {
    headers: Object.assign({ 'X-Forwarded-For': forwardedFor(vu) }, json),
  });
  check(joined, { 'guest joined': (r) => r.status === 201 });
  const cookie = joined.cookies['vp.party-guest'];
  return Object.assign({ 'x-party-credential': cookie ? cookie[0].value : '' }, json);
}

export function member(data) {
  const { room, seat } = placeOf(__VU);
  const roomId = data.rooms[room];
  const base = API_URLS[__VU % API_URLS.length];
  const controller = seat === 0;
  const guest = !controller && seat % 5 === 4;

  sleep(seat * 0.6);
  const headers = controller ? bearer(tokenOf(__VU)) : joinAs(base, roomId, __VU, guest);
  const ticket = http.post(`${base}/v1/watch-parties/${roomId}/socket-ticket`, null, { headers });
  if (!check(ticket, { 'ticket issued': (r) => r.status === 201 })) {
    socketErrors.add(1);
    return;
  }

  const startedAt = Date.now();
  const socket = new WebSocket(
    `${base.replace(/^http/, 'ws')}/v1/watch-parties/${roomId}/socket?ticket=${ticket.json('ticket')}`
  );
  const caused = { superseded: 0, kicked: 0 };
  let versions = { version: 0, rolesVersion: 0 };
  let offset = 0;
  let memberRole = null;
  let ref = 0;
  let rate = 1;
  let allowed = true;
  const send = (frame) =>
    socket.send(JSON.stringify(Object.assign({ ref: `r${(ref += 1)}` }, frame)));
  const serverNow = () => Date.now() + offset;

  socket.addEventListener('open', () => socketErrors.add(0));
  socket.addEventListener('error', () => socketErrors.add(1));
  socket.addEventListener('message', (event) => {
    const frame = JSON.parse(event.data);
    switch (frame.type) {
      case 'hello':
        versions = { version: frame.version, rolesVersion: frame.rolesVersion };
        if (controller) {
          send(Object.assign({ type: 'start' }, versions));
        }
        break;
      case 'state':
        versions.version = frame.version;
        if (frame.playback && frame.playback.anchorAt && frame.reason === 'command') {
          stateLatency.add(Math.max(0, serverNow() - frame.playback.anchorAt));
        }
        break;
      case 'roles': {
        versions.rolesVersion = frame.rolesVersion;
        const role = frame.roles.find((candidate) => candidate.key === 'member');
        if (role) {
          memberRole = role;
          rolesLatency.add(Math.max(0, serverNow() - Date.parse(role.updatedAt)));
        }
        break;
      }
      case 'clock':
        offset = frame.serverNow - (frame.t0 + (Date.now() - frame.t0) / 2);
        break;
      case 'superseded':
      case 'kicked':
        unexpectedFrames.add(1);
        break;
      default:
        break;
    }
  });

  socket.addEventListener('open', () => {
    const ping = () => socket.send(JSON.stringify({ type: 'clock', t0: Date.now() }));
    ping();
    socket.setInterval(ping, 30000);
    socket.setInterval(
      () => send({ type: 'chat.send', message: `hello from ${__VU}` }),
      30000 + (__VU % 7) * 1000
    );
    socket.setInterval(() => {
      for (let burst = 0; burst < 3; burst += 1)
        socket.send(JSON.stringify({ type: 'react', emoji: '🔥' }));
    }, 45000);

    if (controller) {
      socket.setInterval(() => {
        rate = rate === 1 ? 1.25 : 1;
        send(Object.assign({ type: 'rate', rate }, versions));
      }, 20000);
      socket.setInterval(() => {
        if (!memberRole) return;
        allowed = !allowed;
        const permissions = memberRole.permissions.filter((id) => id !== 'playback.control');
        const res = http.patch(
          `${base}/v1/watch-parties/${roomId}/roles/${memberRole.id}`,
          JSON.stringify({
            permissions: allowed ? permissions.concat('playback.control') : permissions,
            updatedAt: memberRole.updatedAt,
          }),
          { headers }
        );
        check(res, { 'role flipped': (r) => r.status === 200 });
        if (res.status === 200) memberRole = res.json();
      }, 60000);
    }
  });

  while (Date.now() - startedAt < DURATION_S * 1000) sleep(1);
  socket.close();
}

function promValue(query) {
  const res = http.get(`${PROM}/api/v1/query?query=${encodeURIComponent(query)}`);
  const result = res.json('data.result');
  return result && result.length > 0 ? result.map((row) => Number(row.value[1])) : [];
}

export function verify() {
  const [p95] = promValue(
    'histogram_quantile(0.95, sum(rate(watch_party_fanout_seconds_bucket[10m])) by (le))'
  );
  if (p95 !== undefined && !Number.isNaN(p95)) fanoutP95.add(p95 * 1000);
  for (const bytes of promValue(
    'max_over_time(vp_process_resident_memory_bytes{job="api"}[15m])'
  )) {
    apiRssMb.add(bytes / 1048576);
  }
  check(p95, { 'prometheus answered the fan-out query': (value) => value !== undefined });
}
