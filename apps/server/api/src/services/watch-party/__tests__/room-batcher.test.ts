import { RoomBatcher } from '../room-batcher';
import { elapse, fakeTimers } from './watch-party-socket-fixture';

function setUp() {
  const flushed: { roomId: string; items: readonly number[] }[] = [];
  const batcher = new RoomBatcher<number>({
    windowMs: 250,
    flush: async (roomId, items) => {
      flushed.push({ roomId, items });
    },
  });
  return { batcher, flushed };
}

describe('RoomBatcher', () => {
  beforeEach(() => {
    fakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hands on what each room gathered inside its own window, once', async () => {
    const { batcher, flushed } = setUp();

    batcher.add('a', 1);
    await elapse(100);
    batcher.add('a', 2);
    batcher.add('b', 3);
    await elapse(150);
    const first = [...flushed];
    await elapse(100);

    expect(first).toEqual([{ roomId: 'a', items: [1, 2] }]);
    expect(flushed).toEqual([
      { roomId: 'a', items: [1, 2] },
      { roomId: 'b', items: [3] },
    ]);
  });

  it('starts a new window for what arrives after a flush', async () => {
    const { batcher, flushed } = setUp();

    batcher.add('a', 1);
    await elapse(250);
    batcher.add('a', 2);
    await elapse(250);

    expect(flushed.map(({ items }) => items)).toEqual([[1], [2]]);
  });

  it('drops what is pending once closed', async () => {
    const { batcher, flushed } = setUp();

    batcher.add('a', 1);
    batcher.close();
    await elapse(500);

    expect(flushed).toEqual([]);
  });
});
