import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { Container } from '@vp/composition';
import type { WorkerStageName } from '@vp/env-schema';
import { inProcessAppConfig } from '@vp/env-schema';
import { mediaTools } from '@vp/ffmpeg';
import { LogContext, createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { completionOf } from '../../__tests__/flow-harness';
import { OutboxRelay } from '../../stages/housekeeping/outbox-relay';
import { Worker, registerStages } from '../stages.module';

async function stageContainer(stage: WorkerStageName, tmpDir = os.tmpdir(), outbox = true) {
  const c = await registerAdapters(
    new Container(),
    inProcessAppConfig({ worker: { stage, tmpDir } })
  );
  return registerStages(c, {
    logger: createLogger({ format: 'json', service: 'stages-test', level: 'silent' }),
    logContext: new LogContext(),
    media: mediaTools,
    workerId: 'stages-test',
    outboxRelay: { enabled: outbox },
  });
}

function consumeQueue(c: Container): InMemoryJobQueue {
  const { queue } = c.get(Worker.Consumer);
  if (!(queue instanceof InMemoryJobQueue))
    throw new Error('an in-process stage consumes in memory');
  return queue;
}

async function jobCounts(c: Container) {
  return expectOk(await consumeQueue(c).getJobCounts());
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
    await consumeQueue(c).add('tmp-sweep', { task: 'tmp-sweep' });

    expect((await jobCounts(c)).completed).toBe(0);
    expectOk(await c.start());
    expect((await jobCounts(c)).completed).toBe(1);

    await c.dispose();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('leaves queue depth to the API poller and times how long the job waited', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-stages-'));
    const c = await stageContainer('housekeeping', tmpDir);
    const queue = consumeQueue(c);
    expectOk(await c.start());
    const swept = completionOf(queue, 'tmp-sweep--1');
    await queue.add('tmp-sweep', { task: 'tmp-sweep' }, { jobId: 'tmp-sweep--1' });
    await swept;

    const metrics = c.get(Adapters.Metrics);
    const { values } = await metrics.bullmqQueueJobs.get();
    expect(values).toEqual([]);
    const waits = await metrics.jobWaitDuration.get();
    const waitCount = waits.values.find((sample) => sample.metricName === 'job_wait_seconds_count');
    expect(waitCount?.value).toBe(1);
    await c.dispose();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('counts a stalled job as result="stalled"', async () => {
    const c = await stageContainer('notify');
    const queue = consumeQueue(c);
    expectOk(await c.start());

    queue.stall('job-1');

    const { values } = await c.get(Adapters.Metrics).jobsProcessed.get();
    expect(values).toEqual([
      expect.objectContaining({ labels: { queue: 'notify', result: 'stalled' }, value: 1 }),
    ]);
    await c.dispose();
  });

  it('fails a job whose stage returned a failure', async () => {
    const c = await stageContainer('notify');
    const queue = consumeQueue(c);
    expectOk(await c.start());
    const notified = completionOf(queue, 'notify--1');
    await queue.add('notify', { videoId: 'not-a-uuid' }, { jobId: 'notify--1' });

    await expect(notified).rejects.toThrow();
    expect((await jobCounts(c)).failed).toBe(1);
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
