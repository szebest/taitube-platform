import { createPatchBatch } from '../patch-batch';

const DELAY_MS = 400;

const startBatch = () => {
  const send = vi.fn();
  return { send, batch: createPatchBatch(send, DELAY_MS) };
};

describe('createPatchBatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the changes made within the delay as one, later fields winning', () => {
    const { send, batch } = startBatch();

    batch.add({ playback: { speed: 1.5 } });
    vi.advanceTimersByTime(DELAY_MS - 1);
    batch.add({ playback: { speed: 2, autoplayNext: false } });
    vi.advanceTimersByTime(DELAY_MS);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ playback: { speed: 2, autoplayNext: false } })
    );
  });

  it('sends nothing before the delay, and the waiting change at once on flush', () => {
    const { send, batch } = startBatch();

    batch.add({ playback: { speed: 2 } });
    expect(send).not.toHaveBeenCalled();
    batch.flush();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('drops the waiting change on cancel', () => {
    const { send, batch } = startBatch();

    batch.add({ playback: { speed: 2 } });
    batch.cancel();
    vi.advanceTimersByTime(DELAY_MS);

    expect(send).not.toHaveBeenCalled();
  });

  it('reports a change as waiting from its add until it is sent or dropped', () => {
    const { batch } = startBatch();

    expect(batch.hasWaiting()).toBe(false);
    batch.add({ playback: { speed: 2 } });
    expect(batch.hasWaiting()).toBe(true);
    vi.advanceTimersByTime(DELAY_MS);

    expect(batch.hasWaiting()).toBe(false);
  });
});
