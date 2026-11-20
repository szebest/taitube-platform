import type { PlaybackStore } from './fake-playback';

function addDistinct(store: PlaybackStore, dedupKey: string, viewer: string, ttl: string) {
  const sketch = store.sketches.get(dedupKey) ?? new Set<string>();
  const added = !sketch.has(viewer);
  sketch.add(viewer);
  store.sketches.set(dedupKey, sketch);
  store.ttls.set(dedupKey, Number(ttl));
  return added;
}

function bump(store: PlaybackStore, key: string, field: string): void {
  const hash = store.hashes.get(key) ?? new Map<string, string>();
  hash.set(field, String(Number(hash.get(field) ?? 0) + 1));
  store.hashes.set(key, hash);
}

function moveHash(store: PlaybackStore, from: string, to: string): void {
  const hash = store.hashes.get(from);
  if (!hash) return;
  store.hashes.delete(from);
  store.hashes.set(to, hash);
}

export function recordView(store: PlaybackStore, keys: string[], argv: string[]): number {
  const [dedupKey = '', bufferKey = '', hourlyKey = ''] = keys;
  const [viewer = '', ttl = '0', viewsField = '', hourlyField = ''] = argv;
  if (!addDistinct(store, dedupKey, viewer, ttl)) return 0;
  bump(store, bufferKey, viewsField);
  bump(store, hourlyKey, hourlyField);
  return 1;
}

export function recordShareLinkOpen(store: PlaybackStore, keys: string[], argv: string[]): number {
  const [dedupKey = '', bufferKey = ''] = keys;
  const [viewer = '', ttl = '0', opensField = ''] = argv;
  if (!addDistinct(store, dedupKey, viewer, ttl)) return 0;
  bump(store, bufferKey, opensField);
  return 1;
}

export function snapshotViews(store: PlaybackStore, keys: string[], argv: string[]) {
  const [
    pointer = '',
    buffer = '',
    batchKey = '',
    retention = '',
    retentionBatchKey = '',
    hourly = '',
    hourlyBatchKey = '',
  ] = keys;
  const [batchId = ''] = argv;
  const pending = store.strings.get(pointer);
  if (pending !== undefined) return pending;
  if (![buffer, retention, hourly].some((key) => store.hashes.has(key))) return null;
  moveHash(store, buffer, batchKey);
  moveHash(store, retention, retentionBatchKey);
  moveHash(store, hourly, hourlyBatchKey);
  store.strings.set(pointer, batchId);
  return batchId;
}

export function releaseViews(store: PlaybackStore, keys: string[], argv: string[]): number {
  const [pointer = '', ...batchKeys] = keys;
  const [batchId = ''] = argv;
  if (store.strings.get(pointer) !== batchId) return 0;
  store.strings.delete(pointer);
  for (const key of batchKeys) store.hashes.delete(key);
  return 1;
}
