import { groupDocs } from './env-doc';

export const LIVE_DOCS = groupDocs('live', {
  LIVE_HOOK_SECRET: {
    description:
      'The secret MediaMTX sends on every auth and event call. Unset, the API refuses every gateway call and no one can publish; production refuses the local value.',
    example: '<random 32 bytes>',
    visibility: 'secret',
    readBy: ['api', 'worker'],
  },
  LIVE_INGEST_URL: {
    description:
      "Where the live worker reads a publisher's stream from (RTSP on MediaMTX). A wrong value leaves a live stream without packaging.",
    example: 'rtsp://mediamtx:8554',
    visibility: 'public',
    readBy: ['worker'],
  },
  LIVE_GATEWAY_API_URL: {
    description:
      'The MediaMTX control API: who is publishing, and kicking a publisher. Unreachable, live status checks and moderation kicks fail.',
    example: 'http://mediamtx:9997',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  LIVE_RTMP_PUBLIC_URL: {
    description:
      'The RTMP server URL a creator pastes into OBS. It must be reachable from the creator machine, not from the cluster.',
    example: 'rtmp://live.example.com:1935/live',
    visibility: 'public',
    readBy: ['api'],
  },
  LIVE_WHIP_PUBLIC_URL: {
    description:
      "MediaMTX's WHIP endpoint, followed by /{stream key}. It must be reachable from the creator browser.",
    example: 'https://live.example.com:8889/live',
    visibility: 'public',
    readBy: ['api'],
  },
});

export const WATCH_PARTY_DOCS = groupDocs('watch-party', {
  WATCH_PARTY_MAX_MEMBERS: {
    description:
      'The ceiling on a room capacity; a room with none set holds this many. At least 2.',
    example: '200',
    visibility: 'public',
    readBy: ['api'],
  },
  WATCH_PARTY_MAX_OPEN_PER_USER: {
    description: 'How many open rooms one owner holds before creating another is refused.',
    example: '3',
    visibility: 'public',
    readBy: ['api'],
  },
  WATCH_PARTY_GUEST_SALT: {
    description:
      'Keys the guest IP hash kept for a ban. Unset, guest joins are switched off; production refuses the local value.',
    example: '<random 32 bytes>',
    visibility: 'secret',
    readBy: ['api'],
  },
});

export const OBSERVABILITY_DOCS = groupDocs('observability', {
  OTEL_EXPORTER_OTLP_ENDPOINT: {
    description:
      'Where the apps send OTLP/HTTP traces: the local collector, or Alloy in the cloud. Unreachable, traces are dropped and the process still runs.',
    example: 'http://alloy:4318',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  OTEL_TRACES_SAMPLER: {
    description:
      'The trace sampler, using the OpenTelemetry names. The cloud runs parentbased_traceidratio to keep the volume down.',
    example: 'parentbased_traceidratio',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  OTEL_TRACES_SAMPLER_ARG: {
    description:
      'The sampling ratio between 0 and 1 for the traceidratio samplers. The cloud runs 0.2.',
    example: '0.2',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  OTEL_RESOURCE_ATTRIBUTES: {
    description:
      'Comma list of key=value resource attributes stamped on every span, such as the deployment environment dashboards filter on.',
    example: 'deployment.environment=cloud',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
});
