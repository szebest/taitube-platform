import type { Server } from 'node:net';

export function boundPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('not bound to a TCP port');
  return address.port;
}
