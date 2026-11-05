export interface SocketClient<Frame> {
  socket: WebSocket;
  /** The first `count` frames, waiting for the ones not here yet. */
  next(count: number): Promise<Frame[]>;
  close(): Promise<void>;
}

/**
 * A browser-style socket to an app listening on loopback: `injectWS` builds its client from `ws`,
 * which Bun replaces with its own, so a spec that must also pass `bun test` dials in instead.
 */
export async function dial<Frame>(address: string, path: string): Promise<SocketClient<Frame>> {
  const socket = new WebSocket(`${address.replace(/^http/, 'ws')}${path}`);
  const frames: Frame[] = [];
  const waiters: (() => void)[] = [];
  socket.addEventListener('message', (event) => {
    frames.push(JSON.parse(String(event.data)));
    for (const wake of waiters.splice(0)) wake();
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error(`${path} did not open`)), {
      once: true,
    });
  });
  return {
    socket,
    next: async (count) => {
      while (frames.length < count) await new Promise<void>((wake) => waiters.push(wake));
      return frames.slice(0, count);
    },
    close: async () => {
      if (socket.readyState === WebSocket.CLOSED) return;
      const closed = new Promise((resolve) => socket.addEventListener('close', resolve));
      socket.close();
      await closed;
    },
  };
}
