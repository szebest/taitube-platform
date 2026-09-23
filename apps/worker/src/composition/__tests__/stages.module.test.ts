import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import type { WorkerStageName } from '@vp/env-schema';
import { inProcessAppConfig } from '@vp/env-schema';
import { createLogger, createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { OutboxRelay } from '../../stages/housekeeping/outbox-relay';
import { Worker, registerStages } from '../stages.module';

async function stageContainer(stage: WorkerStageName, tmpDir = os.tmpdir(), outbox = true) {
  const c = await registerAdapters(
    new Container(),
    inProcessAppConfig({ worker: { stage, tmpDir } })
  );
  return registerStages(c, {
    logger: createLogger({ service: 'stages-test', level: 'silent' }),
    metrics: createMetricsRegistry(),
    workerId: 'stages-test',
    outboxRelay: { enabled: outbox },
  });
}

async function settled(c: Container) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return expectOk(await c.get(Worker.ConsumeQueue).getJobCounts());
}

describe('apps/worker/composition: stages module', () => {
  it('consumes the queue of the stage the configuration names', async () => {
    const c = await stageContainer('transcode-720p');

    expect(c.get(Worker.Stage).queue).toBe('transcode-720p');
    expect(c.get(Worker.Consumer).queue).toBe(c.get(Worker.ConsumeQueue));
    await c.dispose();
  });

  it('completes a job once started, and not before', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-stages-'));
    const c = await stageContainer('housekeeping', tmpDir);
    const { queue } = c.get(Worker.Consumer);
    await queue.add('tmp-sweep', { task: 'tmp-sweep' });

    expect((await settled(c)).completed).toBe(0);
    expectOk(await c.start());
    expect((await settled(c)).completed).toBe(1);

    await c.dispose();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails a job whose stage returned a failure', async () => {
    const c = await stageContainer('notify');
    const { queue } = c.get(Worker.Consumer);

    expectOk(await c.start());
    await queue.add('notify', { videoId: 'not-a-uuid' });

    expect((await settled(c)).failed).toBe(1);
    await c.dispose();
  });

  it.each([
    { stage: 'housekeeping', outbox: true, relays: true },
    { stage: 'housekeeping', outbox: false, relays: false },
    { stage: 'probe', outbox: true, relays: false },
  ] as const)(
    'runs the outbox relay on $stage only when enabled ($outbox): $relays',
    async ({ stage, outbox, relays }) => {
      const c = await stageContainer(stage, os.tmpdir(), outbox);

      expect(c.get(Worker.OutboxRelay) instanceof OutboxRelay).toBe(relays);
      await c.dispose();
    }
  );
});
