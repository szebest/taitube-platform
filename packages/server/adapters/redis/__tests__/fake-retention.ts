export interface RetentionStore {
  readonly strings: Map<string, string>;
  readonly hashes: Map<string, Map<string, string>>;
  readonly ttls: Map<string, number>;
}

export function recordRetention(store: RetentionStore, keys: string[], argv: string[]): number {
  const [sessionKey = '', bufferKey = ''] = keys;
  const [target = '0', step = '1', ttl = '0', videoId = ''] = argv;
  const last = store.strings.get(sessionKey);
  const hash = store.hashes.get(bufferKey) ?? new Map<string, string>();
  const first = last === undefined ? 0 : Number(last) + Number(step);
  for (let percent = first; percent <= Number(target); percent += Number(step)) {
    const field = `${videoId}|${percent}`;
    hash.set(field, String(Number(hash.get(field) ?? 0) + 1));
  }
  store.hashes.set(bufferKey, hash);
  if (last === undefined || Number(last) < Number(target)) store.strings.set(sessionKey, target);
  store.ttls.set(sessionKey, Number(ttl));
  return 1;
}
