export const SYNC_CHANNEL = 'taitube-sync';

export type SyncMessage =
  | { type: 'status-request' }
  | { type: 'clear-queue' }
  | { type: 'pending'; pending: number }
  | { type: 'replayed'; pending: number; videoIds: string[] };
