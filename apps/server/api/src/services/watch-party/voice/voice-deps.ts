import type { VoiceGatewayPort } from '@vp/core/ports';
import type { VoiceConfig } from '@vp/env-schema';
import type { WatchPartyDeps } from '../watch-party-deps';
import type { VoiceEnforcement } from './voice-enforcement';

/** What the voice service adds to every watch party service's collaborators. */
export interface VoiceServiceDeps extends WatchPartyDeps {
  readonly gateway: VoiceGatewayPort;
  readonly voice: VoiceConfig;
  readonly enforcement: VoiceEnforcement;
}
