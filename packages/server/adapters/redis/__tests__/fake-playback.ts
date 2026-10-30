import type { RetentionStore } from './fake-retention';

export interface PlaybackStore extends RetentionStore {
  readonly sketches: Map<string, Set<string>>;
}

export function recordPlayback(store: PlaybackStore, keys: string[], argv: string[]): number {
  const [sessionKey = '', dedupKey = '', bufferKey = ''] = keys;
  const [viewer = '', ttl = '0', watchField = '', watchedNow = '0', required = '0', viewsField = ''] =
    argv;
  const session = store.hashes.get(sessionKey) ?? new Map<string, string>();
  const buffer = store.hashes.get(bufferKey) ?? new Map<string, string>();
  store.hashes.set(sessionKey, session);
  store.hashes.set(bufferKey, buffer);

  const watched = Number(session.get('watched') ?? 0) + Number(watchedNow);
  const credited = Number(session.get('credited') ?? 0);
  session.set('watched', String(watched));
  if (Math.floor(watched) > credited) {
    buffer.set(watchField, String(Number(buffer.get(watchField) ?? 0) + Math.floor(watched) - credited));
    session.set('credited', String(Math.floor(watched)));
  }
  store.ttls.set(sessionKey, Number(ttl));
  if (watched < Number(required)) return -1;
  if (session.has('counted')) return -1;
  session.set('counted', '1');

  const sketch = store.sketches.get(dedupKey) ?? new Set<string>();
  store.sketches.set(dedupKey, sketch);
  store.ttls.set(dedupKey, Number(ttl));
  if (sketch.has(viewer)) return 0;
  sketch.add(viewer);
  buffer.set(viewsField, String(Number(buffer.get(viewsField) ?? 0) + 1));
  return 1;
}
