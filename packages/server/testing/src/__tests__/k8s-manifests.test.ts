import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

describe('Kubernetes Manifests & Overlays (Ticket 25 & 26)', () => {
  const repoRoot = path.resolve(__dirname, '../../../../../');
  const localOverlayDir = path.join(repoRoot, 'infra/k8s/overlays/local');
  const cloudOverlayDir = path.join(repoRoot, 'infra/k8s/overlays/cloud');

  it('renders local overlay successfully using kustomize', () => {
    const output = execSync(`kubectl kustomize "${localOverlayDir}"`, {
      encoding: 'utf-8',
    });
    expect(output).toBeDefined();
    const documents = yaml.loadAll(output) as Array<Record<string, any>>;
    expect(documents.length).toBeGreaterThan(10);

    // Verify Namespace
    const ns = documents.find((d) => d?.kind === 'Namespace');
    expect(ns?.metadata?.name).toBe('video-pipeline');

    // Verify API Deployment
    const apiDep = documents.find(
      (d) => d?.kind === 'Deployment' && d?.metadata?.name === 'vp-api'
    );
    expect(apiDep).toBeDefined();
    expect(apiDep?.spec.replicas).toBe(2);
    expect(apiDep?.spec.template.spec.securityContext.runAsNonRoot).toBe(true);
    expect(apiDep?.spec.template.spec.securityContext.runAsUser).toBe(10001);

    const apiContainer = apiDep?.spec.template.spec.containers[0];
    expect(apiContainer.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(apiContainer.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(apiContainer.resources.requests.cpu).toBe('250m');
    expect(apiContainer.resources.requests.memory).toBe('256Mi');
    expect(apiContainer.resources.limits.cpu).toBe('1000m');
    expect(apiContainer.resources.limits.memory).toBe('512Mi');
    expect(apiContainer.livenessProbe.httpGet.path).toBe('/livez');
    expect(apiContainer.readinessProbe.httpGet.path).toBe('/readyz');

    // Verify API HPA
    const apiHpa = documents.find((d) => d?.kind === 'HorizontalPodAutoscaler');
    expect(apiHpa).toBeDefined();
    expect(apiHpa?.spec.scaleTargetRef.name).toBe('vp-api');
    expect(apiHpa?.spec.minReplicas).toBe(2);

    // Verify Worker Deployments per stage
    const workerStages = [
      {
        name: 'vp-worker-probe',
        stage: 'probe',
        grace: 60,
        reqCpu: '500m',
        reqMem: '512Mi',
        limCpu: '1000m',
        limMem: '1Gi',
        threads: true,
      },
      {
        name: 'vp-worker-transcode-1080p',
        stage: 'transcode-1080p',
        grace: 900,
        reqCpu: '1500m',
        reqMem: '1.5Gi',
        limCpu: '2',
        limMem: '2Gi',
        threads: true,
      },
      {
        name: 'vp-worker-transcode-720p',
        stage: 'transcode-720p',
        grace: 600,
        reqCpu: '1000m',
        reqMem: '1Gi',
        limCpu: '2',
        limMem: '1.5Gi',
        threads: true,
      },
      {
        name: 'vp-worker-transcode-480p',
        stage: 'transcode-480p',
        grace: 300,
        reqCpu: '500m',
        reqMem: '512Mi',
        limCpu: '1',
        limMem: '1Gi',
        threads: true,
      },
      {
        name: 'vp-worker-thumbnail',
        stage: 'thumbnail',
        grace: 120,
        reqCpu: '500m',
        reqMem: '512Mi',
        limCpu: '1000m',
        limMem: '1Gi',
        threads: true,
      },
      {
        name: 'vp-worker-package',
        stage: 'package',
        grace: 120,
        reqCpu: '500m',
        reqMem: '512Mi',
        limCpu: '1000m',
        limMem: '1Gi',
        threads: true,
      },
      {
        name: 'vp-worker-notify',
        stage: 'notify',
        grace: 30,
        reqCpu: '100m',
        reqMem: '128Mi',
        limCpu: '500m',
        limMem: '256Mi',
        threads: false,
      },
      {
        name: 'vp-worker-housekeeping',
        stage: 'housekeeping',
        grace: 60,
        reqCpu: '200m',
        reqMem: '256Mi',
        limCpu: '500m',
        limMem: '512Mi',
        threads: false,
      },
    ];

    for (const ws of workerStages) {
      const dep = documents.find((d) => d?.kind === 'Deployment' && d?.metadata?.name === ws.name);
      expect(dep, `Deployment ${ws.name} must exist`).toBeDefined();
      expect(dep?.spec.replicas).toBe(1);
      expect(dep?.spec.template.spec.terminationGracePeriodSeconds).toBe(ws.grace);
      expect(dep?.spec.template.spec.securityContext.runAsNonRoot).toBe(true);
      expect(dep?.spec.template.spec.securityContext.runAsUser).toBe(10001);

      const container = dep?.spec.template.spec.containers[0];
      expect(container.securityContext.readOnlyRootFilesystem).toBe(true);
      expect(container.securityContext.allowPrivilegeEscalation).toBe(false);
      expect(container.resources.requests.cpu).toBe(ws.reqCpu);
      expect(container.resources.requests.memory).toBe(ws.reqMem);
      expect(container.resources.limits.cpu).toBe(ws.limCpu);
      expect(container.resources.limits.memory).toBe(ws.limMem);

      // Verify liveness probe with heartbeat
      expect(container.livenessProbe).toBeDefined();
      expect(container.livenessProbe.exec.command[2]).toContain('/tmp/vp/heartbeat');

      // Verify FFMPEG_THREADS from limits.cpu if relevant
      if (ws.threads) {
        const threadEnv = container.env.find((e: any) => e.name === 'FFMPEG_THREADS');
        expect(threadEnv?.valueFrom?.resourceFieldRef?.resource).toBe('limits.cpu');
      }

      // Verify emptyDir for /tmp/vp
      const tmpVolume = dep?.spec.template.spec.volumes.find((v: any) => v.name === 'tmp');
      expect(tmpVolume).toBeDefined();
      expect(tmpVolume.emptyDir).toBeDefined();
      expect(tmpVolume.emptyDir.sizeLimit).toBeDefined();
    }

    // Verify Migration Job
    const migrateJob = documents.find(
      (d) => d?.kind === 'Job' && d?.metadata?.name === 'vp-migrate'
    );
    expect(migrateJob).toBeDefined();
    expect(migrateJob?.spec.template.spec.containers[0].command).toEqual([
      'node',
      'dist/migrate.js',
    ]);

    // Verify ServiceMonitors
    const sm = documents.filter((d) => d?.kind === 'ServiceMonitor');
    expect(sm.length).toBe(2);

    // Verify Ingress
    const ingress = documents.find((d) => d?.kind === 'Ingress');
    expect(ingress).toBeDefined();
    const paths = ingress?.spec.rules[0].http.paths.map((p: any) => p.path);
    expect(paths).toContain('/v1');
    expect(paths).toContain('/readyz');
    expect(paths).toContain('/livez');
  });

  it('validates KEDA ScaledObjects in local overlay (Ticket 26)', () => {
    const output = execSync(`kubectl kustomize "${localOverlayDir}"`, {
      encoding: 'utf-8',
    });
    const documents = yaml.loadAll(output) as Array<Record<string, any>>;
    const scaledObjects = documents.filter((d) => d?.kind === 'ScaledObject');

    expect(scaledObjects.length).toBe(8);

    const expectedConfigs: Record<
      string,
      {
        stage: string;
        targetDep: string;
        maxReplicas: number;
        hasRedisFallback?: boolean;
      }
    > = {
      'vp-worker-probe-scaledobject': {
        stage: 'probe',
        targetDep: 'vp-worker-probe',
        maxReplicas: 4,
      },
      'vp-worker-transcode-1080p-scaledobject': {
        stage: 'transcode-1080p',
        targetDep: 'vp-worker-transcode-1080p',
        maxReplicas: 6,
      },
      'vp-worker-transcode-720p-scaledobject': {
        stage: 'transcode-720p',
        targetDep: 'vp-worker-transcode-720p',
        maxReplicas: 6,
      },
      'vp-worker-transcode-480p-scaledobject': {
        stage: 'transcode-480p',
        targetDep: 'vp-worker-transcode-480p',
        maxReplicas: 6,
        hasRedisFallback: true,
      },
      'vp-worker-thumbnail-scaledobject': {
        stage: 'thumbnail',
        targetDep: 'vp-worker-thumbnail',
        maxReplicas: 4,
      },
      'vp-worker-package-scaledobject': {
        stage: 'package',
        targetDep: 'vp-worker-package',
        maxReplicas: 4,
      },
      'vp-worker-notify-scaledobject': {
        stage: 'notify',
        targetDep: 'vp-worker-notify',
        maxReplicas: 4,
      },
      'vp-worker-housekeeping-scaledobject': {
        stage: 'housekeeping',
        targetDep: 'vp-worker-housekeeping',
        maxReplicas: 2,
      },
    };

    for (const so of scaledObjects) {
      const name = so.metadata?.name;
      const expected = expectedConfigs[name];
      expect(expected, `ScaledObject ${name} must be known`).toBeDefined();
      if (!expected) continue;

      expect(so.metadata?.namespace).toBe('video-pipeline');
      expect(so.spec.scaleTargetRef.name).toBe(expected.targetDep);
      expect(so.spec.minReplicaCount).toBe(0);
      expect(so.spec.maxReplicaCount).toBe(expected.maxReplicas);
      expect(so.spec.pollingInterval).toBe(10);
      expect(so.spec.cooldownPeriod).toBe(300);

      // HPA behavior: fast up, slow down
      const hpaConfig = so.spec.advanced?.horizontalPodAutoscalerConfig?.behavior;
      expect(hpaConfig).toBeDefined();
      expect(hpaConfig.scaleUp.stabilizationWindowSeconds).toBe(0);
      expect(hpaConfig.scaleDown.stabilizationWindowSeconds).toBe(300);

      // Prometheus scaler trigger
      const promTrigger = so.spec.triggers.find((t: any) => t.type === 'prometheus');
      expect(promTrigger, `ScaledObject ${name} must have a Prometheus trigger`).toBeDefined();
      expect(promTrigger.metadata.serverAddress).toBe(
        'http://kube-prometheus-stack-prometheus.monitoring.svc:9090'
      );
      expect(promTrigger.metadata.threshold).toBe('1');
      expect(promTrigger.metadata.activationThreshold).toBe('0');
      expect(promTrigger.metadata.query).toContain(`queue="${expected.stage}"`);
      expect(promTrigger.metadata.query).toContain('state=~"waiting|prioritized|active"');
      expect(promTrigger.metadata.query).toContain('or vector(0)');

      // Redis fallback trigger on transcode-480p
      if (expected.hasRedisFallback) {
        const redisTrigger = so.spec.triggers.find((t: any) => t.type === 'redis');
        expect(redisTrigger, 'vp-worker-transcode-480p must have a redis trigger').toBeDefined();
        expect(redisTrigger.metadata.addressFromEnv).toBe('REDIS_ADDR');
        expect(redisTrigger.metadata.passwordFromEnv).toBe('REDIS_PASSWORD');
        expect(redisTrigger.metadata.listName).toBe('bull:transcode-480p:wait');
        expect(redisTrigger.metadata.listLength).toBe('1');
        expect(redisTrigger.metadata.activationListLength).toBe('0');
      }
    }
  });

  it('renders cloud overlay and validates overlay replica caps (Ticket 26)', () => {
    const output = execSync(`kubectl kustomize "${cloudOverlayDir}"`, {
      encoding: 'utf-8',
    });
    expect(output).toBeDefined();
    const documents = yaml.loadAll(output) as Array<Record<string, any>>;
    expect(documents.length).toBeGreaterThan(10);

    const scaledObjects = documents.filter((d) => d?.kind === 'ScaledObject');
    expect(scaledObjects.length).toBe(8);

    // Cloud overlay constraints per SDD §12.3: 1 for 1080p/720p, 2 for 480p/probe
    const transcode1080p = scaledObjects.find(
      (s) => s.metadata?.name === 'vp-worker-transcode-1080p-scaledobject'
    );
    expect(transcode1080p?.spec.maxReplicaCount).toBe(1);

    const transcode720p = scaledObjects.find(
      (s) => s.metadata?.name === 'vp-worker-transcode-720p-scaledobject'
    );
    expect(transcode720p?.spec.maxReplicaCount).toBe(1);

    const transcode480p = scaledObjects.find(
      (s) => s.metadata?.name === 'vp-worker-transcode-480p-scaledobject'
    );
    expect(transcode480p?.spec.maxReplicaCount).toBe(2);

    const probe = scaledObjects.find((s) => s.metadata?.name === 'vp-worker-probe-scaledobject');
    expect(probe?.spec.maxReplicaCount).toBe(2);
  });

  it('validates cloud overlay resources and configuration (Ticket 32)', () => {
    const output = execSync(`kubectl kustomize "${cloudOverlayDir}"`, {
      encoding: 'utf-8',
    });
    const documents = yaml.loadAll(output) as Array<Record<string, any>>;

    // Cloudflare Tunnel Deployment
    const cloudflared = documents.find(
      (d) => d?.kind === 'Deployment' && d?.metadata?.name === 'cloudflared'
    );
    expect(cloudflared).toBeDefined();
    expect(cloudflared?.spec.template.spec.containers[0].image).toContain('cloudflare/cloudflared');

    // Redis StatefulSet
    const redisSts = documents.find(
      (d) => d?.kind === 'StatefulSet' && d?.metadata?.name === 'vp-redis-master'
    );
    expect(redisSts).toBeDefined();
    expect(redisSts?.spec.volumeClaimTemplates).toHaveLength(1);
    expect(redisSts?.spec.volumeClaimTemplates[0].metadata.name).toBe('redis-data');

    // Alloy Deployment & ConfigMap
    const alloyDep = documents.find(
      (d) => d?.kind === 'Deployment' && d?.metadata?.name === 'alloy'
    );
    expect(alloyDep).toBeDefined();
    const alloyCm = documents.find(
      (d) => d?.kind === 'ConfigMap' && d?.metadata?.name === 'alloy-config'
    );
    expect(alloyCm).toBeDefined();
    expect(alloyCm?.data['config.alloy']).toContain('otelcol.receiver.otlp');

    // ConfigMap patches
    const vpConfig = documents.find(
      (d) => d?.kind === 'ConfigMap' && d?.metadata?.name === 'vp-config'
    );
    expect(vpConfig).toBeDefined();
    expect(vpConfig?.data.DATABASE_POOL_MAX).toBe('5');
    expect(vpConfig?.data.CDN_BASE_URL).toBe('https://cdn.example.com');
    expect(vpConfig?.data.REDIS_ADDR).toBe('vp-redis-master:6379');
    expect(vpConfig?.data.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://alloy:4318');
    expect(vpConfig?.data.HOUSEKEEPING_INTERVAL_MS).toBe('900000');
  });
});
