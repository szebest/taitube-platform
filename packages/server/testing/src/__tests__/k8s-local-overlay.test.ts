import {
  containerOf,
  livenessPasses,
  named,
  ofKind,
  overlay,
  STALE_AFTER_SECONDS,
  WORKER_STAGES,
} from './k8s-manifests-harness';

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

    const container = containerOf(deployment);
    expect(container.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(container.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(container.resources.requests).toMatchObject({ cpu: '250m', memory: '256Mi' });
    expect(container.resources.limits).toMatchObject({ cpu: '1000m', memory: '512Mi' });
    expect(container.livenessProbe.httpGet?.path).toBe('/livez');
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
      .map((doc) => doc.metadata?.name ?? '')
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

      const container = containerOf(deployment);
      expect(container.securityContext.readOnlyRootFilesystem).toBe(true);
      expect(container.securityContext.allowPrivilegeEscalation).toBe(false);
      expect(container.resources.requests).toMatchObject(requests);
      expect(container.resources.limits).toMatchObject(limits);
      expect(container.livenessProbe.exec.command[2]).toBe(
        `test -f /tmp/vp/heartbeat && test $(( $(date +%s) - $(cat /tmp/vp/heartbeat) )) -lt ${STALE_AFTER_SECONDS}`
      );
      expect(container.readinessProbe.httpGet).toEqual({ path: '/readyz', port: 'metrics' });

      const tmpVolume = deployment?.spec.template.spec.volumes.find((v) => v.name === 'tmp');
      expect(tmpVolume?.emptyDir?.sizeLimit).toBeDefined();
    }
  );

  it.each([
    { heartbeat: 'a fresh heartbeat', age: 5, alive: true },
    { heartbeat: 'a heartbeat three intervals old', age: STALE_AFTER_SECONDS, alive: false },
    { heartbeat: 'no heartbeat file', age: undefined, alive: false },
  ])('fails worker liveness on $heartbeat: $alive', ({ age, alive }) => {
    const container = containerOf(named('local', 'Deployment', 'vp-worker-probe'));

    expect(livenessPasses(container.livenessProbe.exec.command[2] ?? '', age)).toBe(alive);
  });

  it.each(WORKER_STAGES.filter((s) => s.threads))(
    '$name derives FFMPEG_THREADS from its cpu limit',
    ({ name }) => {
      const container = containerOf(named('local', 'Deployment', name));
      const threadEnv = container.env.find((e) => e.name === 'FFMPEG_THREADS');
      expect(threadEnv?.valueFrom?.resourceFieldRef?.resource).toBe('limits.cpu');
    }
  );

  it('migrates the database from a job', () => {
    const job = named('local', 'Job', 'vp-migrate');
    expect(job).toBeDefined();
    expect(containerOf(job).command).toEqual(['node', 'dist/migrate.js']);
  });

  it('scrapes both services', () => {
    expect(ofKind('local', 'ServiceMonitor')).toHaveLength(2);
  });

  it('routes the api and its probes through the ingress', () => {
    const ingress = ofKind('local', 'Ingress')[0];
    expect(ingress).toBeDefined();
    const paths = ingress?.spec.rules[0]?.http.paths.map((p) => p.path);
    expect(paths).toEqual(expect.arrayContaining(['/v1', '/readyz', '/livez']));
  });
});
