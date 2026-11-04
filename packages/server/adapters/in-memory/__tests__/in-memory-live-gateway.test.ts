import { expectOk } from '@vp/testing/result';
import { InMemoryLiveGateway } from '../in-memory-live-gateway';

describe('adapters/in-memory: InMemoryLiveGateway', () => {
  it('reports a published path until it is kicked', async () => {
    const gateway = new InMemoryLiveGateway();
    gateway.publish('live/key');

    expect(expectOk(await gateway.isPublishing('live/key'))).toBe(true);
    expectOk(await gateway.kick('live/key'));
    expect(expectOk(await gateway.isPublishing('live/key'))).toBe(false);
    expect(gateway.kicked).toEqual(['live/key']);
  });

  it('kicks nobody on a path nobody publishes on', async () => {
    const gateway = new InMemoryLiveGateway();

    expectOk(await gateway.kick('live/key'));
    expect(gateway.kicked).toEqual([]);
  });

  it('forgets everything on clear', async () => {
    const gateway = new InMemoryLiveGateway();
    gateway.publish('live/key');
    await gateway.kick('live/key');
    gateway.publish('live/other');

    gateway.clear();

    expect(gateway.kicked).toEqual([]);
    expect(expectOk(await gateway.isPublishing('live/other'))).toBe(false);
  });
});
