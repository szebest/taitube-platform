import { randomUUID } from 'node:crypto';
import type { FlowProducerPort, JobQueue } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface FlowProducerSubject {
  readonly producer: FlowProducerPort;
  /** The queue a flow node names, opened on the same backend as the producer. */
  queue(name: string): JobQueue;
  close(): Promise<void>;
}

export type MakeFlowProducerSubject = () => Promise<FlowProducerSubject>;

export function describeFlowProducerContract(makeSubject: MakeFlowProducerSubject): void {
  describe('FlowProducer contract', () => {
    let subject: FlowProducerSubject;
    let parentQueue: JobQueue;
    let childQueue: JobQueue;
    let parentJobId: string;

    beforeEach(async () => {
      subject = await makeSubject();
      const scope = `contract-${randomUUID()}`;
      parentQueue = subject.queue(`${scope}-parent`);
      childQueue = subject.queue(`${scope}-child`);
      parentJobId = `${scope}-parent-job`;
      expectOk(
        await subject.producer.add({
          name: 'assemble',
          queueName: parentQueue.getName(),
          data: { step: 'parent' },
          opts: { jobId: parentJobId },
          children: [
            {
              name: 'render',
              queueName: childQueue.getName(),
              data: { step: 'child' },
              opts: { jobId: `${scope}-child-job` },
            },
          ],
        })
      );
    });

    afterEach(async () => {
      await subject.close();
    });

    it('answers a health check', async () => {
      expectOk(await subject.producer.checkHealth());
    });

    it('holds the parent back while a child has not run', async () => {
      expect(expectOk(await parentQueue.getJobState(parentJobId))).toBe('waiting-children');
    });

    it('runs the parent once its child completes, with the value the child returned', async () => {
      const parentSaw = Promise.withResolvers<unknown[]>();
      expectOk(
        await parentQueue.process(async (job) => {
          const values = (await job.getChildrenValues?.()) ?? {};
          parentSaw.resolve(Object.values(values));
          return 'assembled';
        })
      );

      expectOk(await childQueue.process(async () => 'rendered'));

      expect(await parentSaw.promise).toContain('rendered');
    });

    it('runs a nested flow bottom up, each level reading the values below it', async () => {
      const scope = `contract-${randomUUID()}`;
      const top = subject.queue(`${scope}-top`);
      const middle = subject.queue(`${scope}-middle`);
      const leaf = subject.queue(`${scope}-leaf`);
      expectOk(
        await subject.producer.add({
          name: 'top',
          queueName: top.getName(),
          data: {},
          opts: { jobId: `${scope}-top-job` },
          children: [
            {
              name: 'middle',
              queueName: middle.getName(),
              data: {},
              opts: { jobId: `${scope}-middle-job` },
              children: [
                {
                  name: 'leaf',
                  queueName: leaf.getName(),
                  data: {},
                  opts: { jobId: `${scope}-leaf-job` },
                },
              ],
            },
          ],
        })
      );
      const topSaw = Promise.withResolvers<unknown[]>();
      expectOk(
        await top.process(async (job) => {
          topSaw.resolve(Object.values((await job.getChildrenValues?.()) ?? {}));
          return 'top';
        })
      );
      expectOk(
        await middle.process(async (job) => {
          const below = new Set(Object.values((await job.getChildrenValues?.()) ?? {}));
          return `middle(${[...below].join(',')})`;
        })
      );
      expectOk(await leaf.process(async () => 'leaf'));

      expect(await topSaw.promise).toContain('middle(leaf)');
    });
  });
}
