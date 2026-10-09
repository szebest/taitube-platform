import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { JOB_PRIORITY } from '@vp/domain';
import { queueUnavailable } from '@vp/errors';
import { ids, stagePolicies } from '@vp/job-contracts';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { buildProbeDispatch, enqueueProbe } from '../probe-dispatch';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000b1';
const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

function dispatch(overrides: { generation?: number; priority?: number } = {}) {
  return buildProbeDispatch({
    videoId: VIDEO_ID,
    sourceKey: `raw/${VIDEO_ID}/source.mp4`,
    generation: overrides.generation ?? 1,
    traceparent: TRACEPARENT,
    priority: overrides.priority,
  });
}

describe('apps/api/services: probe dispatch', () => {
  it('derives the job id from the video and its generation', () => {
    expect(dispatch({ generation: 3 }).opts.jobId).toBe(ids.probe(VIDEO_ID, 3));
  });

  it('carries the stage retry policy', () => {
    expect(dispatch().opts).toMatchObject(stagePolicies.probe);
  });

  it.each([
    ['falls back to the stage priority', undefined, stagePolicies.probe.priority],
    ['lets a paid tier jump the queue', 1, 1],
  ])('%s', (_label, priority, expected) => {
    expect(dispatch({ priority }).opts.priority).toBe(expected);
  });

  it('falls back to the same lane a free owner gets', () => {
    expect(stagePolicies.probe.priority).toBe(JOB_PRIORITY.free);
  });

  it('answers nothing when the fast path is refused, since the outbox row delivers the job', async () => {
    const queue = new InMemoryJobQueue('probe');
    vi.spyOn(queue, 'add').mockResolvedValue(err(queueUnavailable('add')));

    await expect(enqueueProbe(queue, dispatch({}))).resolves.toBeUndefined();
  });

  it('commits the same job to the outbox that the fast path enqueues', async () => {
    const queue = new InMemoryJobQueue('probe');
    const built = dispatch({ generation: 2 });

    await enqueueProbe(queue, built);
    const [job] = expectOk(await queue.getJobs(['waiting', 'delayed', 'active', 'completed']));

    expect(built.outbox.payload).toMatchObject({
      type: 'queue',
      queueName: 'probe',
      job: { name: 'probe', data: built.data, opts: built.opts },
    });
    expect(job).toMatchObject({ name: 'probe', data: built.data });
  });
});
