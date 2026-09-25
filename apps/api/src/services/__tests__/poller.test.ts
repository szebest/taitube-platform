import { expectOk } from '@vp/testing/result';
import { Poller } from '../poller';

describe('apps/api/services: Poller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens no timer until it is started', () => {
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const poll = vi.fn(async () => {});

    new Poller(poll, 1_000);

    expect(intervals).not.toHaveBeenCalled();
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

  it('keeps sampling after a sample that throws', async () => {
    vi.useFakeTimers();
    const poll = vi.fn(async () => {
      throw new Error('scrape failed');
    });
    const poller = new Poller(poll, 1_000);

    expectOk(await poller.start());
    await Promise.resolve();
    vi.advanceTimersByTime(1_000);
    poller.stop();

    expect(poll).toHaveBeenCalledTimes(2);
  });
});
