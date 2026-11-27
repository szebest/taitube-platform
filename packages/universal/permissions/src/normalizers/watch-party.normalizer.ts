import type { EffectivePermissions, MemberKind } from '@vp/domain';
import type { WatchPartyViewer } from '../types/index';

export interface WatchPartySeat {
  readonly kind: MemberKind;
  readonly isOwner: boolean;
  readonly effective: EffectivePermissions;
}

/** Below Guest's position, so a caller without a seat outranks nobody. */
const NO_SEAT_POSITION = -1;

export function toWatchPartyViewer(seat: WatchPartySeat | null): WatchPartyViewer {
  if (seat === null) {
    return { permissions: [], topPosition: NO_SEAT_POSITION, isOwner: false, kind: null };
  }
  const { kind, isOwner, effective } = seat;
  return { permissions: effective.permissions, topPosition: effective.topPosition, isOwner, kind };
}
