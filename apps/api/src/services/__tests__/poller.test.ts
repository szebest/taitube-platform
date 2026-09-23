import { expectOk } from '@vp/testing/result';
import { Poller } from '../poller';

describe('apps/api/services: Poller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens no timer until it is started', () => {
    const poll = vi.fn(async () => {});
    const before = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;

    new Poller(poll, 1_000);

    expect(process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length).toBe(before);
    expect(poll).not.toHaveBeenCalled();
  });

  it('samples at once on start and then on every interval', async () => {
    vi.useFakeTimers();
    const poll = vi.fn(async () => {});
    const poller = new Poller(poll, 1_000);

    expectOk(await poller.start());
    vi.advanceTimersByTime(2_000);

    expect(poll).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it('stops sampling once stopped, and starting twice opens one timer', async () => {
    vi.useFakeTimers();
    const poll = vi.fn(async () => {});
    const poller = new Poller(poll, 1_000);

    await poller.start();
    await poller.start();
    poller.stop();
    vi.advanceTimersByTime(5_000);

    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('survives a sample that throws', async () => {
    const poller = new Poller(async () => {
      throw new Error('scrape failed');
    }, 1_000);

    expectOk(await poller.start());
    await new Promise((resolve) => setImmediate(resolve));
    poller.stop();
  });
});
