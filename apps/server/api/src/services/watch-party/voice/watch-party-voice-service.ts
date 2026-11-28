import type { PartyCaller } from '../party-caller';
import type { VoiceServiceDeps } from './voice-deps';
import { removeFromVoice } from './voice-moderation';
import { mintVoiceToken } from './voice-token';
import { receiveVoiceWebhook } from './voice-webhook';

export class WatchPartyVoiceService {
  constructor(private readonly deps: VoiceServiceDeps) {}

  token(roomId: string, caller: PartyCaller, listenOnly: boolean) {
    return mintVoiceToken(this.deps, roomId, caller, listenOnly);
  }

  remove(roomId: string, caller: PartyCaller, memberKey: string) {
    return removeFromVoice(this.deps, roomId, caller, memberKey);
  }

  webhook(body: string, authorization: string | undefined) {
    return receiveVoiceWebhook(this.deps, body, authorization);
  }
}
