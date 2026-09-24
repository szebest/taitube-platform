import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { describeFlowProducerContract } from '../../__tests__/contract/flow-producer.contract';
import { inMemoryFlowProducerSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { InMemoryFlowProducer } from '../in-memory-flow-producer';
import { InMemoryJobQueue } from '../in-memory-job-queue';

describeFlowProducerContract(inMemoryFlowProducerSubject);

describe('InMemoryFlowProducer', () => {
  const child = { name: 'render', queueName: 'render', data: {}, opts: { jobId: 'child' } };

  it.each([
    { scenario: 'its parent queue', known: ['render'] },
    { scenario: 'one of its child queues', known: ['assemble'] },
  ])('refuses a flow whose $scenario it cannot run in memory', async ({ known }) => {
    const queues = new Map(known.map((name) => [name, new InMemoryJobQueue(name)]));
    const producer = new InMemoryFlowProducer((name) => queues.get(name));

    const refused = expectErr(
      await producer.add({ name: 'assemble', queueName: 'assemble', data: {}, children: [child] })
    );

    expect(refused.code).toBe(ErrorCodes.QUEUE_UNAVAILABLE);
    for (const queue of queues.values()) {
      expect(expectOk(await queue.getJobs(['waiting']))).toEqual([]);
    }
  });

  it('fails the parent when a child that fails it fails', async () => {
    const parentQueue = new InMemoryJobQueue('assemble');
    const childQueue = new InMemoryJobQueue('render');
    const queues = new Map([
      ['assemble', parentQueue],
      ['render', childQueue],
    ]);
    const producer = new InMemoryFlowProducer((name) => queues.get(name));
    const parentFailed = Promise.withResolvers<string>();
    parentQueue.onFailed((job) => parentFailed.resolve(job.id));
    expectOk(
      await childQueue.process(async () => {
        throw new Error('render broke');
      })
    );

    expectOk(
      await producer.add({
        name: 'assemble',
        queueName: 'assemble',
        data: {},
        opts: { jobId: 'parent' },
        children: [{ ...child, opts: { jobId: 'child', failParentOnFailure: true } }],
      })
    );

    expect(await parentFailed.promise).toBe('parent');
  });
});
