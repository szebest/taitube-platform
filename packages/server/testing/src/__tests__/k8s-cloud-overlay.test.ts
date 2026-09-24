import {
  WORKER_STAGES,
  containerOf,
  named,
  ofKind,
  overlay,
  scaledObjectOf,
} from './k8s-manifests-harness';

const CLOUD_REPLICA_CAPS = [
  { name: 'vp-worker-transcode-1080p', maxReplicas: 1 },
  { name: 'vp-worker-transcode-720p', maxReplicas: 1 },
  { name: 'vp-worker-transcode-480p', maxReplicas: 2 },
  { name: 'vp-worker-probe', maxReplicas: 2 },
];

describe('infra/k8s: cloud overlay', () => {
  it('renders more than ten documents and the same eight scaled objects', () => {
    expect(overlay('cloud').length).toBeGreaterThan(10);
    expect(ofKind('cloud', 'ScaledObject')).toHaveLength(WORKER_STAGES.length);
  });

  it.each(CLOUD_REPLICA_CAPS)('caps $name at $maxReplicas replicas', ({ name, maxReplicas }) => {
    expect(scaledObjectOf('cloud', name)?.spec.maxReplicaCount).toBe(maxReplicas);
  });

  it('fronts the cluster with a cloudflare tunnel', () => {
    const cloudflared = named('cloud', 'Deployment', 'cloudflared');
    expect(cloudflared).toBeDefined();
    expect(containerOf(cloudflared).image).toContain('cloudflare/cloudflared');
  });

  it('persists redis through a volume claim template', () => {
    const redis = named('cloud', 'StatefulSet', 'vp-redis-master');
    expect(redis).toBeDefined();
    expect(redis?.spec.volumeClaimTemplates).toHaveLength(1);
    expect(redis?.spec.volumeClaimTemplates[0]?.metadata.name).toBe('redis-data');
  });

  it('ships telemetry through alloy', () => {
    expect(named('cloud', 'Deployment', 'alloy')).toBeDefined();
    const config = named('cloud', 'ConfigMap', 'alloy-config');
    expect(config?.data['config.alloy']).toContain('otelcol.receiver.otlp');
  });

  it('patches the runtime config for the cloud topology', () => {
    const config = named('cloud', 'ConfigMap', 'vp-config');
    expect(config?.data).toMatchObject({
      DATABASE_POOL_MAX: '5',
      CDN_BASE_URL: 'https://cdn.example.com',
      REDIS_ADDR: 'vp-redis-master:6379',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy:4318',
      AUTH_JWKS_URL: 'https://auth.example.com/.well-known/jwks.json',
    });
  });
});
