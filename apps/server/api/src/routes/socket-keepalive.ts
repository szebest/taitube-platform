export interface KeepAliveOptions {
  pingIntervalMs: number;
  maxBufferedBytes: number;
}

interface KeptSocket {
  readonly bufferedAmount: number;
  send(data: string): void;
  ping(): void;
  terminate(): void;
  on(event: 'pong' | 'close', listener: () => void): unknown;
}

/**
 * Pings the peer every interval and drops it when the last ping went unanswered, so a viewer whose
 * network died stops holding a socket and a hub listener. `send` drops a peer whose unsent frames
 * pass `maxBufferedBytes` instead of buffering a busy chat for it without bound.
 */
export function keepAlive(socket: KeptSocket, options: KeepAliveOptions): (frame: object) => void {
  let answered = true;
  socket.on('pong', () => {
    answered = true;
  });
  const timer = setInterval(() => {
    if (!answered) return socket.terminate();
    answered = false;
    socket.ping();
  }, options.pingIntervalMs);
  socket.on('close', () => clearInterval(timer));

  return (frame) => {
    if (socket.bufferedAmount > options.maxBufferedBytes) return socket.terminate();
    socket.send(JSON.stringify(frame));
  };
}
