import { MS_PER_SECOND } from './time';

/**
 * 250 ms because two people talking over a call notice a gap of about a third of a second; 2 s
 * because a 5 % nudge closes 2 s in 40 s, past which a seek is less noticeable than a long speed change.
 */
export const WATCH_PARTY_DRIFT = {
  ignoreBelowMs: 250,
  seekAboveMs: 2 * MS_PER_SECOND,
  settledWithinMs: 100,
  nudge: 0.05,
  seekCooldownMs: 3 * MS_PER_SECOND,
  checkIntervalMs: MS_PER_SECOND,
  reportIntervalMs: 30 * MS_PER_SECOND,
} as const;

export interface DriftInput {
  /** The player's position minus the room's expected position: positive is ahead. */
  readonly driftMs: number;
  readonly expectedMs: number;
  readonly roomRate: number;
  /** The rate the player runs at now, the room's or a nudge. */
  readonly playerRate: number;
  readonly seekLatencyMs: number;
  readonly now: number;
  readonly cooldownUntil: number;
}

export type DriftAction =
  | { readonly type: 'hold' }
  | { readonly type: 'rate'; readonly rate: number }
  | { readonly type: 'seek'; readonly positionMs: number; readonly cooldownUntil: number };

const HOLD: DriftAction = { type: 'hold' };

/** What the player does about its drift on one check. */
export function correctDrift(input: DriftInput): DriftAction {
  const { driftMs, expectedMs, roomRate, playerRate, seekLatencyMs, now, cooldownUntil } = input;
  if (now < cooldownUntil) return HOLD;

  const distance = Math.abs(driftMs);
  if (distance > WATCH_PARTY_DRIFT.seekAboveMs) {
    return {
      type: 'seek',
      positionMs: expectedMs + seekLatencyMs,
      cooldownUntil: now + WATCH_PARTY_DRIFT.seekCooldownMs,
    };
  }

  const nudging = playerRate !== roomRate;
  const settled = distance <= WATCH_PARTY_DRIFT.settledWithinMs;
  if (nudging && settled) return { type: 'rate', rate: roomRate };
  if (!nudging && distance < WATCH_PARTY_DRIFT.ignoreBelowMs) return HOLD;

  const rate = roomRate * (driftMs > 0 ? 1 - WATCH_PARTY_DRIFT.nudge : 1 + WATCH_PARTY_DRIFT.nudge);
  return rate === playerRate ? HOLD : { type: 'rate', rate };
}
