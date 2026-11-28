import { InMemoryVoiceGateway } from '@vp/adapters/in-memory';
import type { VoiceTokenRequest } from '@vp/core/ports';
import type { WatchPartyPreset } from '@vp/domain';
import type { AppConfigOverrides } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { seatGuest } from '../../__tests__/watch-party-moderation-fixture';
import { socketRoom } from '../../__tests__/watch-party-socket-fixture';
import { MEMBER, OTHER, watchPartyTestConfig } from '../../__tests__/watch-party-test-deps';
import type { VoiceServiceDeps } from '../voice-deps';
import { VoiceEnforcement } from '../voice-enforcement';

type Party = Awaited<ReturnType<typeof socketRoom>>;

/** The media server, its enforcement and the service deps, over a room that already exists. */
export async function voiceOn(party: Party, config?: AppConfigOverrides) {
  const gateway = new InMemoryVoiceGateway();
  const enforcement = new VoiceEnforcement({
    repositories: party.deps.repositories,
    broadcaster: party.deps.broadcaster,
    logger: party.deps.logger,
    now: party.deps.now,
    gateway,
    hub: party.socketDeps.hub,
    maxSpeakers: watchPartyTestConfig(config).voice.maxSpeakers,
  });
  const voice: VoiceServiceDeps = {
    ...party.deps,
    gateway,
    enforcement,
    voice: watchPartyTestConfig(config).voice,
  };
  await party.socketDeps.hub.init();
  return { ...party, gateway, enforcement, voice };
}

export async function voiceRoom(
  options: {
    preset?: WatchPartyPreset;
    config?: AppConfigOverrides;
    members?: UserContext[];
  } = {}
) {
  const party = await socketRoom({
    preset: options.preset,
    config: options.config,
    members: options.members ?? [MEMBER, OTHER],
  });
  await seatGuest(party.repositories, party.deps.now());
  return voiceOn(party, options.config);
}

export type VoiceRoom = Awaited<ReturnType<typeof voiceRoom>>;

/** What a token minted by the in-memory media server carries. */
export function claimsOf(token: string): VoiceTokenRequest {
  return JSON.parse(token.slice('twin.'.length)) as VoiceTokenRequest;
}
