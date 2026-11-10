export interface SyncBadge {
  copy: 'party.stageReconnecting' | 'party.stageCatchingUp' | 'party.stageSyncing';
  tone: 'warning' | 'neutral';
}

/** The stage badge: the socket first, then whether the player is closing a gap to the room. */
export function getSyncBadge(connected: boolean, catchingUp: boolean): SyncBadge {
  if (!connected) {
    return { copy: 'party.stageReconnecting', tone: 'warning' };
  }
  if (catchingUp) {
    return { copy: 'party.stageCatchingUp', tone: 'warning' };
  }
  return { copy: 'party.stageSyncing', tone: 'neutral' };
}
