import {
  correctDrift,
  expectedPositionMs,
  WATCH_PARTY_DRIFT,
  type WatchPartyPlayback,
} from '@vp/domain';

interface PartyPlayerSnapshot {
  paused: boolean;
  buffering: boolean;
  positionMs: number;
  rate: number;
}

export interface PartySyncInput {
  playback: WatchPartyPlayback;
  serverNow: number;
  now: number;
  player: PartyPlayerSnapshot;
  cooldownUntil: number;
  /** The player stayed paused after a play that the room asked for. */
  playRefused: boolean;
}

type PartySyncStep =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'mute' }
  | { type: 'seek'; positionMs: number }
  | { type: 'rate'; rate: number };

export interface PartySyncPlan {
  steps: PartySyncStep[];
  cooldownUntil: number;
  hardSeek: boolean;
  driftMs: number;
}

function isRoomRunning({ playback, serverNow }: Pick<PartySyncInput, 'playback' | 'serverNow'>) {
  return playback.phase === 'playing' && serverNow >= playback.anchorAt;
}

function planHeld(input: PartySyncInput, expectedMs: number): PartySyncPlan {
  const { player, cooldownUntil } = input;
  const driftMs = player.positionMs - expectedMs;
  const steps: PartySyncStep[] = [];

  if (!player.paused) {
    steps.push({ type: 'pause' });
  }
  const hardSeek = Math.abs(driftMs) > WATCH_PARTY_DRIFT.ignoreBelowMs;
  if (hardSeek) {
    steps.push({ type: 'seek', positionMs: expectedMs });
  }

  return { steps, cooldownUntil, hardSeek, driftMs };
}

/**
 * What the player does on one check so that it shows the room's clock: hold still at the room's
 * position while the room is not playing, otherwise play, and close the drift by a nudge or a seek.
 */
export function planPartySync(input: PartySyncInput): PartySyncPlan {
  const { playback, serverNow, now, player, cooldownUntil, playRefused } = input;
  const expectedMs = expectedPositionMs(playback, serverNow);

  if (!isRoomRunning(input)) {
    return planHeld(input, expectedMs);
  }

  const steps: PartySyncStep[] = [];
  if (player.paused) {
    if (playRefused) {
      steps.push({ type: 'mute' });
    }
    steps.push({ type: 'play' });
  }
  const driftMs = player.positionMs - expectedMs;
  if (player.buffering) {
    return { steps, cooldownUntil, hardSeek: false, driftMs };
  }

  const action = correctDrift({
    driftMs,
    expectedMs,
    roomRate: playback.rate,
    playerRate: player.rate,
    seekLatencyMs: 0,
    now,
    cooldownUntil,
  });
  switch (action.type) {
    case 'hold':
      return { steps, cooldownUntil, hardSeek: false, driftMs };
    case 'rate':
      return {
        steps: [...steps, { type: 'rate', rate: action.rate }],
        cooldownUntil,
        hardSeek: false,
        driftMs,
      };
    case 'seek':
      return {
        steps: [...steps, { type: 'seek', positionMs: action.positionMs }],
        cooldownUntil: action.cooldownUntil,
        hardSeek: true,
        driftMs,
      };
  }
}
