import { hasControllingWorker } from './is-queued-by-worker';

export function queueableNetworkMode(): 'always' | 'online' {
  return hasControllingWorker() ? 'always' : 'online';
}
