import { ErrorCodes } from '@vp/errors';
import { isOk } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import type { FlowProducer } from 'bullmq';
import { BullMqFlowProducer } from '../bullmq-flow-producer';

interface FakeFlowProducerInit {
  pingResult?: string;
  failClient?: boolean;
  addError?: Error;
  closeError?: Error;
}

class FakeFlowProducer {
  readonly added: unknown[] = [];
  closed = false;

  constructor(private readonly init: FakeFlowProducerInit = {}) {}

  get client(): Promise<{ ping(): Promise<string> }> {
    if (this.init.failClient) return Promise.reject(new Error('no connection'));
    return Promise.resolve({ ping: async () => this.init.pingResult ?? 'PONG' });
  }

  async add(node: unknown): Promise<unknown> {
    if (this.init.addError) throw this.init.addError;
    this.added.push(node);
    return { job: { id: 'flow-1' } };
  }

  async close(): Promise<void> {
    if (this.init.closeError) throw this.init.closeError;
    this.closed = true;
  }

  asProducer(): FlowProducer {
    return this as unknown as FlowProducer;
  }
}

const FLOW = {
  name: 'transcode-fanin',
  queueName: 'package',
  data: { videoId: 'v1' },
  children: [{ name: 'transcode', queueName: 'transcode', data: { rendition: '720p' } }],
};

describe('BullMqFlowProducer', () => {
  it('passes the flow tree straight to the driver', async () => {
    const fake = new FakeFlowProducer();
    const producer = new BullMqFlowProducer({ producer: fake.asProducer() });

    expect(expectOk(await producer.add(FLOW))).toEqual({ job: { id: 'flow-1' } });
    expect(fake.added).toEqual([FLOW]);
  });

  it('reports an add failure as QUEUE_UNAVAILABLE naming the operation', async () => {
    const producer = new BullMqFlowProducer({
      producer: new FakeFlowProducer({ addError: new Error('redis unavailable') }).asProducer(),
    });

    expect(expectErr(await producer.add(FLOW))).toMatchObject({
      code: ErrorCodes.QUEUE_UNAVAILABLE,
      operation: 'add',
    });
  });

  it.each([
    { scenario: 'the client answers PONG', init: {}, expected: true },
    { scenario: 'the client answers otherwise', init: { pingResult: 'NOPE' }, expected: false },
    { scenario: 'there is no connection', init: { failClient: true }, expected: false },
  ])('reports health as $expected when $scenario', async ({ init, expected }) => {
    const producer = new BullMqFlowProducer({
      producer: new FakeFlowProducer(init).asProducer(),
    });

    expect(isOk(await producer.checkHealth())).toBe(expected);
  });

  it('closes the driver', async () => {
    const fake = new FakeFlowProducer();
    await new BullMqFlowProducer({ producer: fake.asProducer() }).close();

    expect(fake.closed).toBe(true);
  });

  it('reports a close failure as QUEUE_UNAVAILABLE', async () => {
    const producer = new BullMqFlowProducer({
      producer: new FakeFlowProducer({ closeError: new Error('still draining') }).asProducer(),
    });

    expect(expectErr(await producer.close()).code).toBe(ErrorCodes.QUEUE_UNAVAILABLE);
  });
});
