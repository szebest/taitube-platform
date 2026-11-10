import type { EnvKeyDocBody } from './env-doc';

/** Keys outside `AppEnvSchema`: client build-time keys, keys handed to other tools, tooling keys. */
export const EXTRA_GROUPS = [
  {
    id: 'client',
    title: 'Client build-time keys',
    summary:
      'Read by the web and studio apps, never by the API or a worker. VITE_* is inlined by Vite at build time; SSR_API_BASE_URL is read by their servers at start.',
  },
  {
    id: 'platform',
    title: 'Platform keys',
    summary:
      'Handed to something other than this repo code. platform-env.json names the consumer of each.',
  },
  {
    id: 'tooling',
    title: 'Tooling and cloud-only keys',
    summary:
      'Left commented in .env.example: read by Terraform, Alloy, k6 and the cloud runbooks, never by the apps.',
  },
] as const;

type ExtraEnvGroup = (typeof EXTRA_GROUPS)[number]['id'];

export interface ExtraEnvKeyDoc extends EnvKeyDocBody {
  group: ExtraEnvGroup;
}

function extraDocs(
  group: ExtraEnvGroup,
  bodies: Record<string, EnvKeyDocBody>
): Record<string, ExtraEnvKeyDoc> {
  const stamped = Object.entries(bodies).map(([key, body]) => [key, { ...body, group }]);
  return Object.fromEntries(stamped);
}

const CLIENT = extraDocs('client', {
  VITE_API_BASE_URL: {
    description:
      "Where the web and studio servers reach the API; the browser calls the app's own /api proxy instead. Unset, the apps cannot find the API.",
    example: 'http://localhost:3000',
    visibility: 'public',
    readBy: ['web', 'studio'],
  },
  VITE_API_PUBLIC_URL: {
    description:
      "The API origin as the browser reaches it, for the live chat socket (the /api proxy carries no upgrade) and the studio's Bull Board link.",
    example: 'http://localhost:3000',
    visibility: 'public',
    readBy: ['web', 'studio'],
  },
  VITE_STUDIO_URL: {
    description:
      'Where the creator studio is: the web app /upload redirects there and the header upload entry links to it. Defaults to http://localhost:5174.',
    example: 'https://studio.taitube.local',
    visibility: 'public',
    readBy: ['web'],
  },
  VITE_WEB_URL: {
    description:
      "The web app's public origin: the studio links back to it, and the web canonical, OpenGraph and sitemap URLs are absolute on it. Keep it equal to the API's WEB_URL.",
    example: 'https://taitube.local',
    visibility: 'public',
    readBy: ['web', 'studio'],
  },
  VITE_COOKIE_DOMAIN: {
    description:
      'The Domain of the theme and session cookies: the parent domain both apps share in the cloud. Empty locally, where a cookie spans ports.',
    example: 'taitube.local',
    visibility: 'public',
    readBy: ['web', 'studio'],
  },
  VITE_OTEL_TRACES_URL: {
    description:
      'Where the browser sends its OTLP/HTTP spans. Unset, no tracer loads. Each app .env.development and the compose build set the local collector.',
    example: 'http://localhost:4318/v1/traces',
    visibility: 'public',
    readBy: ['web', 'studio'],
  },
  SSR_API_BASE_URL: {
    description:
      'The web and studio servers only, read at start: where the server render and the /api proxy call the API when VITE_API_BASE_URL does not reach it. Empty falls back to VITE_API_BASE_URL.',
    example: 'http://api:3000',
    visibility: 'public',
    readBy: ['web', 'studio'],
  },
});

const PLATFORM = extraDocs('platform', {
  TURBO_TELEMETRY_DISABLED: {
    description:
      'Stops turbo from phoning home, which local-first forbids. Leave it at 1 in every shell and CI job that runs turbo.',
    example: '1',
    visibility: 'public',
    readBy: ['tooling'],
  },
  DO_NOT_TRACK: {
    description:
      'The cross-tool opt-out convention: turbo and other tools that honour it send no telemetry.',
    example: '1',
    visibility: 'public',
    readBy: ['tooling'],
  },
  WORKER_RUNTIME: {
    description:
      'bun or node: picks the worker image stage and its command. It is read by the image, not the app, so changing it needs a rebuild.',
    example: 'bun',
    visibility: 'public',
    readBy: ['infra'],
  },
  GRAFANA_OTLP_ENDPOINT: {
    description:
      "Alloy's upstream OTLP endpoint in the cloud. The apps never read it; they export to Alloy through OTEL_EXPORTER_OTLP_ENDPOINT.",
    example: 'https://otlp-gateway-<region>.grafana.net/otlp',
    visibility: 'public',
    readBy: ['infra'],
  },
  GRAFANA_OTLP_HEADERS: {
    description:
      'The Authorization=Basic header Alloy sends to GRAFANA_OTLP_ENDPOINT, built from the base64 of instanceId:token. Wrong credentials drop all cloud telemetry.',
    example: 'Authorization=Basic <base64 instanceId:token>',
    visibility: 'secret',
    readBy: ['infra'],
  },
  CLOUDFLARE_TUNNEL_TOKEN: {
    description:
      'The token cloudflared uses to attach the cluster to its Cloudflare tunnel. Without it the cloud overlay has no public ingress.',
    example: '<tunnel token>',
    visibility: 'secret',
    readBy: ['infra'],
  },
});

const TOOLING = extraDocs('tooling', {
  PROMETHEUS_REMOTE_WRITE_URL: {
    description:
      'The Grafana Cloud Prometheus push endpoint Alloy writes metrics to. It carries basic-auth credentials in cloud setups.',
    example: '<prometheus push url with credentials>',
    visibility: 'secret',
    readBy: ['infra'],
  },
  LOKI_URL: {
    description:
      'The Grafana Cloud Loki push endpoint Alloy writes logs to. It carries basic-auth credentials in cloud setups.',
    example: '<loki push url with credentials>',
    visibility: 'secret',
    readBy: ['infra', 'tooling'],
  },
  SENTRY_DSN: {
    description:
      'An optional Sentry project DSN, reserved for error reporting. Nothing in the apps reads it yet.',
    example: '<sentry dsn>',
    visibility: 'secret',
    readBy: ['infra'],
  },
  CLOUDFLARE_API_TOKEN: {
    description:
      'The Terraform token for R2 buckets, DNS and the tunnel. Needs only those scopes; a broader token is a liability.',
    example: '<cloudflare api token>',
    visibility: 'secret',
    readBy: ['tooling'],
  },
  CLOUDFLARE_ACCOUNT_ID: {
    description: 'The Cloudflare account Terraform provisions R2 and the tunnel in.',
    example: '<account id>',
    visibility: 'public',
    readBy: ['tooling'],
  },
  HCLOUD_TOKEN: {
    description: 'The Terraform token for the Hetzner Cloud project that hosts the k3s node.',
    example: '<hetzner token>',
    visibility: 'secret',
    readBy: ['tooling'],
  },
  GHCR_USERNAME: {
    description:
      'The GitHub user the cluster pulls private images as. Only needed for private images.',
    example: 'octocat',
    visibility: 'public',
    readBy: ['infra'],
  },
  GHCR_TOKEN: {
    description: 'The GitHub token that pairs with GHCR_USERNAME. Only needed for private images.',
    example: '<ghcr token>',
    visibility: 'secret',
    readBy: ['infra'],
  },
  API: {
    description:
      'The API origin the k6 load tests hit. Defaults to http://localhost:3000 in tests/load.',
    example: 'http://localhost:3000',
    visibility: 'public',
    readBy: ['tooling'],
  },
  TOKEN: {
    description:
      'The bearer token the k6 load tests send, minted with pnpm dev-token mint --raw. Unset, tests/load falls back to a built-in dev token, which only works against AUTH_MODE=dev.',
    example: '<dev jwt>',
    visibility: 'secret',
    readBy: ['tooling'],
  },
  K6_PROMETHEUS_RW_SERVER_URL: {
    description:
      'The Prometheus remote-write endpoint k6 streams its metrics to, for the load-test dashboards.',
    example: 'http://localhost:9090/api/v1/write',
    visibility: 'public',
    readBy: ['tooling'],
  },
});

export const EXTRA_ENV_DOCS = { ...CLIENT, ...PLATFORM, ...TOOLING };
