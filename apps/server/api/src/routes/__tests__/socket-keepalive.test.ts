import { EventEmitter } from 'node:events';
import { keepAlive } from '../socket-keepalive';

const OPTIONS = { pingIntervalMs: 1_000, maxBufferedBytes: 100 };

function peer(bufferedAmount = 0) {
  const socket = Object.assign(new EventEmitter(), {
    bufferedAmount,
    sent: [] as string[],
    pings: 0,
    terminated: false,
    send(data: string) {
      socket.sent.push(data);
    },
    ping() {
      socket.pings += 1;
    },
    terminate() {
      socket.terminated = true;
    },
  });
  return { socket, send: keepAlive(socket, OPTIONS) };
}

describe('apps/server/api/routes: keepAlive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a peer that answers every ping', () => {
    const { socket } = peer();

    for (const _ of [1, 2, 3]) {
      vi.advanceTimersByTime(OPTIONS.pingIntervalMs);
      socket.emit('pong');
    }

    expect([socket.pings, socket.terminated]).toEqual([3, false]);
  });

  it('drops a peer that let a ping go unanswered', () => {
    const { socket } = peer();

    vi.advanceTimersByTime(2 * OPTIONS.pingIntervalMs);

    expect([socket.pings, socket.terminated]).toEqual([1, true]);
  });

  it.each([
    { scenario: 'keeping up', buffered: 100, sent: 1, terminated: false },
    { scenario: 'too far behind', buffered: 101, sent: 0, terminated: true },
  ])('sends to a peer $scenario, or drops it', ({ buffered, sent, terminated }) => {
    const { socket, send } = peer(buffered);

    send({ type: 'removed', id: 'a1' });

    expect([socket.sent.length, socket.terminated]).toEqual([sent, terminated]);
  });

  it('stops pinging once the peer closed', () => {
    const { socket } = peer();

    socket.emit('close');
    vi.advanceTimersByTime(3 * OPTIONS.pingIntervalMs);

    expect(socket.pings).toBe(0);
  });
});
