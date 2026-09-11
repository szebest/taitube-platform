import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

describe('Kubernetes Manifests & Overlays (Ticket 25)', () => {
  const repoRoot = path.resolve(__dirname, '../../../../');
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

  it('renders cloud overlay skeleton successfully using kustomize', () => {
    const output = execSync(`kubectl kustomize "${cloudOverlayDir}"`, {
      encoding: 'utf-8',
    });
    expect(output).toBeDefined();
    const documents = yaml.loadAll(output) as Array<Record<string, any>>;
    expect(documents.length).toBeGreaterThan(10);
  });
});
