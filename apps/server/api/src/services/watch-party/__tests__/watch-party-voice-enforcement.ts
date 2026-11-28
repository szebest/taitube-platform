import type { WatchPartyPermission } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { PartyCaller } from '../party-caller';
import { voiceOn } from '../voice/__tests__/voice-fixture';
import { removeFromVoice } from '../voice/voice-moderation';
import { mintVoiceToken } from '../voice/voice-token';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import type { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OTHER } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

interface VoiceCase {
  readonly alongside?: readonly WatchPartyPermission[];
  attempt(party: Party, caller: PartyCaller): Promise<{ ok: boolean; error?: unknown }>;
}

const outcomeOf = (result: { ok: boolean }) => result as { ok: boolean; error?: unknown };

export const VOICE_ENFORCEMENT = {
  'voice.join': {
    attempt: async (party, caller) =>
      outcomeOf(await mintVoiceToken((await voiceOn(party)).voice, ROOM_ID, caller, true)),
  },
  'voice.speak': {
    alongside: ['voice.join'],
    attempt: async (party, caller) => {
      const room = await voiceOn(party);
      const minted = await mintVoiceToken(room.voice, ROOM_ID, caller, false);
      if (!minted.ok) return outcomeOf(minted);
      room.gateway.join(minted.value.token);
      return room.gateway.publish(`party:${ROOM_ID}`, keyOf(MEMBER))
        ? { ok: true }
        : {
            ok: false,
            error: { code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING, permission: 'voice.speak' },
          };
    },
  },
  'voice.moderate': {
    attempt: async (party, caller) =>
      outcomeOf(await removeFromVoice((await voiceOn(party)).voice, ROOM_ID, caller, keyOf(OTHER))),
  },
} as const satisfies Record<'voice.join' | 'voice.speak' | 'voice.moderate', VoiceCase>;
