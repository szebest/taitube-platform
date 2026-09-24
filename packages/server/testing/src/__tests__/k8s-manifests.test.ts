import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

type Manifest = Record<string, any>;

const repoRoot = path.resolve(__dirname, '../../../../../');
const rendered = new Map<string, Manifest[]>();

function overlay(name: 'local' | 'cloud'): Manifest[] {
  const cached = rendered.get(name);
  if (cached) {
    return cached;
  }
  const dir = path.join(repoRoot, `infra/k8s/overlays/${name}`);
  const documents = yaml.loadAll(
    execSync(`kubectl kustomize "${dir}"`, { encoding: 'utf-8' })
  ) as Manifest[];
  rendered.set(name, documents);
  return documents;
}

function ofKind(name: 'local' | 'cloud', kind: string): Manifest[] {
  return overlay(name).filter((doc) => doc?.kind === kind);
}

function named(name: 'local' | 'cloud', kind: string, metadataName: string): Manifest | undefined {
  return ofKind(name, kind).find((doc) => doc.metadata?.name === metadataName);
}

const WORKER_STAGES = [
  {
    name: 'vp-worker-probe',
    grace: 60,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1000m', memory: '1Gi' },
    threads: true,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-transcode-1080p',
    grace: 900,
    requests: { cpu: '1500m', memory: '1.5Gi' },
    limits: { cpu: '2', memory: '2Gi' },
    threads: true,
    maxReplicas: 6,
    redisFallback: false,
  },
  {
    name: 'vp-worker-transcode-720p',
    grace: 600,
    requests: { cpu: '1000m', memory: '1Gi' },
    limits: { cpu: '2', memory: '1.5Gi' },
    threads: true,
    maxReplicas: 6,
    redisFallback: false,
  },
  {
    name: 'vp-worker-transcode-480p',
    grace: 300,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1', memory: '1Gi' },
    threads: true,
    maxReplicas: 6,
    redisFallback: true,
  },
  {
    name: 'vp-worker-thumbnail',
    grace: 120,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1000m', memory: '1Gi' },
    threads: true,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-package',
    grace: 120,
    requests: { cpu: '500m', memory: '512Mi' },
    limits: { cpu: '1000m', memory: '1Gi' },
    threads: true,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-notify',
    grace: 30,
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '256Mi' },
    threads: false,
    maxReplicas: 4,
    redisFallback: false,
  },
  {
    name: 'vp-worker-housekeeping',
    grace: 60,
    requests: { cpu: '200m', memory: '256Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
    threads: false,
    maxReplicas: 2,
    redisFallback: false,
  },
];

const CLOUD_REPLICA_CAPS = [
  { name: 'vp-worker-transcode-1080p', maxReplicas: 1 },
  { name: 'vp-worker-transcode-720p', maxReplicas: 1 },
  { name: 'vp-worker-transcode-480p', maxReplicas: 2 },
  { name: 'vp-worker-probe', maxReplicas: 2 },
];

const stage = (name: string) => name.replace('vp-worker-', '');
const scaledObjectOf = (name: 'local' | 'cloud', workerName: string) =>
  named(name, 'ScaledObject', `${workerName}-scaledobject`);

describe('infra/k8s: local overlay', () => {
  it('renders more than ten documents in the video-pipeline namespace', () => {
    expect(overlay('local').length).toBeGreaterThan(10);
    expect(named('local', 'Namespace', 'video-pipeline')).toBeDefined();
  });

  it('runs the api as a hardened non-root deployment', () => {
    const deployment = named('local', 'Deployment', 'vp-api');
    expect(deployment).toBeDefined();
    expect(deployment?.spec.replicas).toBe(2);
    expect(deployment?.spec.template.spec.securityContext.runAsNonRoot).toBe(true);
    expect(deployment?.spec.template.spec.securityContext.runAsUser).toBe(10001);

    const container = deployment?.spec.template.spec.containers[0];
    expect(container.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(container.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(container.resources.requests).toMatchObject({ cpu: '250m', memory: '256Mi' });
    expect(container.resources.limits).toMatchObject({ cpu: '1000m', memory: '512Mi' });
    expect(container.livenessProbe.httpGet.path).toBe('/livez');
    expect(container.readinessProbe.httpGet.path).toBe('/readyz');
  });

  it('scales the api from two replicas', () => {
    const hpa = ofKind('local', 'HorizontalPodAutoscaler')[0];
    expect(hpa).toBeDefined();
    expect(hpa?.spec.scaleTargetRef.name).toBe('vp-api');
    expect(hpa?.spec.minReplicas).toBe(2);
  });

  it('deploys exactly the known worker stages', () => {
    const workers = ofKind('local', 'Deployment')
      .map((doc) => doc.metadata?.name as string)
      .filter((name) => name.startsWith('vp-worker-'));
    expect(workers.sort()).toEqual(WORKER_STAGES.map((s) => s.name).sort());
  });

  it.each(WORKER_STAGES)(
    '$name runs hardened with its own resources and heartbeat probe',
    ({ name, grace, requests, limits }) => {
      const deployment = named('local', 'Deployment', name);
      expect(deployment).toBeDefined();
      expect(deployment?.spec.replicas).toBe(1);
      expect(deployment?.spec.template.spec.terminationGracePeriodSeconds).toBe(grace);
      expect(deployment?.spec.template.spec.securityContext.runAsNonRoot).toBe(true);
      expect(deployment?.spec.template.spec.securityContext.runAsUser).toBe(10001);

      const container = deployment?.spec.template.spec.containers[0];
      expect(container.securityContext.readOnlyRootFilesystem).toBe(true);
      expect(container.securityContext.allowPrivilegeEscalation).toBe(false);
      expect(container.resources.requests).toMatchObject(requests);
      expect(container.resources.limits).toMatchObject(limits);
      expect(container.livenessProbe.exec.command[2]).toContain('/tmp/vp/heartbeat');

      const tmpVolume = deployment?.spec.template.spec.volumes.find(
        (v: Manifest) => v.name === 'tmp'
      );
      expect(tmpVolume?.emptyDir?.sizeLimit).toBeDefined();
    }
  );

  it.each(WORKER_STAGES.filter((s) => s.threads))(
    '$name derives FFMPEG_THREADS from its cpu limit',
    ({ name }) => {
      const container = named('local', 'Deployment', name)?.spec.template.spec.containers[0];
      const threadEnv = container.env.find((e: Manifest) => e.name === 'FFMPEG_THREADS');
      expect(threadEnv?.valueFrom?.resourceFieldRef?.resource).toBe('limits.cpu');
    }
  );

  it('migrates the database from a job', () => {
    const job = named('local', 'Job', 'vp-migrate');
    expect(job).toBeDefined();
    expect(job?.spec.template.spec.containers[0].command).toEqual(['node', 'dist/migrate.js']);
  });

  it('scrapes both services', () => {
    expect(ofKind('local', 'ServiceMonitor')).toHaveLength(2);
  });

  it('routes the api and its probes through the ingress', () => {
    const ingress = ofKind('local', 'Ingress')[0];
    expect(ingress).toBeDefined();
    const paths = ingress?.spec.rules[0].http.paths.map((p: Manifest) => p.path);
    expect(paths).toEqual(expect.arrayContaining(['/v1', '/readyz', '/livez']));
  });
});

describe('infra/k8s: local KEDA autoscaling', () => {
  it('declares exactly the known scaled objects', () => {
    const names = ofKind('local', 'ScaledObject').map((doc) => doc.metadata?.name as string);
    expect(names.sort()).toEqual(WORKER_STAGES.map((s) => `${s.name}-scaledobject`).sort());
  });

  it.each(WORKER_STAGES)(
    '$name scales from zero on its own queue depth',
    ({ name, maxReplicas }) => {
      const scaledObject = scaledObjectOf('local', name);
      expect(scaledObject).toBeDefined();
      expect(scaledObject?.metadata?.namespace).toBe('video-pipeline');
      expect(scaledObject?.spec.scaleTargetRef.name).toBe(name);
      expect(scaledObject?.spec.minReplicaCount).toBe(0);
      expect(scaledObject?.spec.maxReplicaCount).toBe(maxReplicas);
      expect(scaledObject?.spec.pollingInterval).toBe(10);
      expect(scaledObject?.spec.cooldownPeriod).toBe(300);

      const behavior = scaledObject?.spec.advanced?.horizontalPodAutoscalerConfig?.behavior;
      expect(behavior).toBeDefined();
      expect(behavior.scaleUp.stabilizationWindowSeconds).toBe(0);
      expect(behavior.scaleDown.stabilizationWindowSeconds).toBe(300);

      const prometheus = scaledObject?.spec.triggers.find((t: Manifest) => t.type === 'prometheus');
      expect(prometheus).toBeDefined();
      expect(prometheus.metadata.serverAddress).toBe(
        'http://kube-prometheus-stack-prometheus.monitoring.svc:9090'
      );
      expect(prometheus.metadata.threshold).toBe('1');
      expect(prometheus.metadata.activationThreshold).toBe('0');
      expect(prometheus.metadata.query).toContain(`queue="${stage(name)}"`);
      expect(prometheus.metadata.query).toContain('state=~"waiting|prioritized|active"');
      expect(prometheus.metadata.query).toContain('or vector(0)');
    }
  );

  it('declares a redis fallback trigger only where a stage asks for one', () => {
    const withRedis = WORKER_STAGES.filter((s) =>
      scaledObjectOf('local', s.name)?.spec.triggers.some((t: Manifest) => t.type === 'redis')
    );
    expect(withRedis).toEqual(WORKER_STAGES.filter((s) => s.redisFallback));
  });

  it.each(WORKER_STAGES.filter((s) => s.redisFallback))(
    '$name falls back to the redis list scaler',
    ({ name }) => {
      const redis = scaledObjectOf('local', name)?.spec.triggers.find(
        (t: Manifest) => t.type === 'redis'
      );
      expect(redis.metadata.addressFromEnv).toBe('REDIS_ADDR');
      expect(redis.metadata.passwordFromEnv).toBe('REDIS_PASSWORD');
      expect(redis.metadata.listName).toBe(`bull:${stage(name)}:wait`);
      expect(redis.metadata.listLength).toBe('1');
      expect(redis.metadata.activationListLength).toBe('0');
    }
  );
});

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
    expect(cloudflared?.spec.template.spec.containers[0].image).toContain('cloudflare/cloudflared');
  });

  it('persists redis through a volume claim template', () => {
    const redis = named('cloud', 'StatefulSet', 'vp-redis-master');
    expect(redis).toBeDefined();
    expect(redis?.spec.volumeClaimTemplates).toHaveLength(1);
    expect(redis?.spec.volumeClaimTemplates[0].metadata.name).toBe('redis-data');
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
