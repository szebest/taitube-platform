import { InMemoryJobQueue, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { describe, expect, it } from 'vitest';
import { createWorkerRunner } from '../runner';

describe('@vp/worker metrics server', () => {
  it('exposes /metrics and /healthz on configured port', async () => {
    const runner = await createWorkerRunner({
      stage: 'probe',
      metricsPort: 0,
      jobQueue: new InMemoryJobQueue('probe'),
      repositories: new InMemoryRepositories(),
      storage: new InMemoryStorageClient(),
    });

    try {
      expect(runner.metricsServer).toBeDefined();
      const port = runner.metricsServer?.port;
      expect(port).toBeGreaterThan(0);

      const res = await fetch(`http://127.0.0.1:${port}/metrics`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('bullmq_queue_jobs');

      const health = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(health.status).toBe(200);
      expect(await health.text()).toBe('ok');
    } finally {
      await runner.close();
    }
  });
});
