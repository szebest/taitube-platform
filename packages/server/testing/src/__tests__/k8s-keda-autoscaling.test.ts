import { WORKER_STAGES, ofKind, scaledObjectOf, stage } from './k8s-manifests-harness';

describe('infra/k8s: local KEDA autoscaling', () => {
  it('declares exactly the known scaled objects', () => {
    const names = ofKind('local', 'ScaledObject').map((doc) => doc.metadata?.name ?? '');
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
      expect(behavior?.scaleUp.stabilizationWindowSeconds).toBe(0);
      expect(behavior?.scaleDown.stabilizationWindowSeconds).toBe(300);

      const prometheus = scaledObject?.spec.triggers.find((t) => t.type === 'prometheus');
      expect(prometheus).toBeDefined();
      expect(prometheus?.metadata['serverAddress']).toBe(
        'http://kube-prometheus-stack-prometheus.monitoring.svc:9090'
      );
      expect(prometheus?.metadata['threshold']).toBe('1');
      expect(prometheus?.metadata['activationThreshold']).toBe('0');
      expect(prometheus?.metadata['query']).toContain(`queue="${stage(name)}"`);
      expect(prometheus?.metadata['query']).toContain('state=~"waiting|prioritized|active"');
      expect(prometheus?.metadata['query']).toContain('or vector(0)');
    }
  );

  it('declares a redis fallback trigger only where a stage asks for one', () => {
    const withRedis = WORKER_STAGES.filter((s) =>
      scaledObjectOf('local', s.name)?.spec.triggers.some((t) => t.type === 'redis')
    );
    expect(withRedis).toEqual(WORKER_STAGES.filter((s) => s.redisFallback));
  });

  it.each(WORKER_STAGES.filter((s) => s.redisFallback))(
    '$name falls back to the redis list scaler',
    ({ name }) => {
      const redis = scaledObjectOf('local', name)?.spec.triggers.find((t) => t.type === 'redis');
      expect(redis?.metadata).toMatchObject({
        addressFromEnv: 'REDIS_ADDR',
        passwordFromEnv: 'REDIS_PASSWORD',
        listName: `bull:${stage(name)}:wait`,
        listLength: '1',
        activationListLength: '0',
      });
    }
  );
});
