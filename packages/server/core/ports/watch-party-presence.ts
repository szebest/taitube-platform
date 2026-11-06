import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface PresenceAdmissionRequest {
  /** From `admissionLimit`: `null` admits at any count (the owner). */
  readonly limit: number | null;
  readonly nowMs: number;
  /** Entries last touched before this are pruned first, so a dead pod frees its spots. */
  readonly staleBeforeMs: number;
}

export type PresenceAdmission =
  | { readonly type: 'admitted'; readonly present: number }
  | { readonly type: 'full'; readonly present: number };

export interface PresentMember {
  readonly memberKey: string;
  /** When this stretch of presence began: the longest present wins an ownership tie. */
  readonly sinceMs: number;
}

/**
 * Who holds a room socket now, counted across pods. Admission is atomic: two pods admitting the
 * last spot at once admit exactly one, and a member already present is admitted again whatever
 * the count.
 */
export interface WatchPartyPresencePort {
  admit(
    roomId: string,
    memberKey: string,
    request: PresenceAdmissionRequest
  ): Promise<Result<PresenceAdmission, CacheUnavailable>>;
  /** The keepalive of the sockets a pod holds. */
  touch(
    roomId: string,
    memberKeys: readonly string[],
    nowMs: number
  ): Promise<Result<void, CacheUnavailable>>;
  leave(roomId: string, memberKey: string): Promise<Result<void, CacheUnavailable>>;
  /** Members touched at or after `staleBeforeMs`, oldest presence first. */
  members(
    roomId: string,
    staleBeforeMs: number
  ): Promise<Result<PresentMember[], CacheUnavailable>>;
}
