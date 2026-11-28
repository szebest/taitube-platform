import type { Result } from '@kit/result';
import type { VoiceUnavailable, VoiceWebhookRejected } from '@vp/errors';

/** What a participant may do in a voice room: audio only, so publishing never carries video or data. */
export interface VoiceGrants {
  readonly canSubscribe: boolean;
  readonly canPublish: boolean;
}

export interface VoiceTokenRequest {
  readonly room: string;
  /** The member key. */
  readonly identity: string;
  readonly name: string;
  readonly grants: VoiceGrants;
  readonly ttlSeconds: number;
}

export interface VoiceParticipant {
  readonly identity: string;
  readonly grants: VoiceGrants;
  /** An audio track is being sent, muted or not. */
  readonly publishing: boolean;
  /** The token it joined with asked to speak: only such a participant is given the mic back by a role change. */
  readonly wantsToSpeak: boolean;
}

export type VoiceWebhookEvent =
  | {
      readonly type: 'participant_joined';
      readonly room: string;
      readonly identity: string;
      readonly canPublish: boolean;
    }
  | { readonly type: 'participant_left'; readonly room: string; readonly identity: string }
  | { readonly type: 'ignored' };

/** The media server's control plane, addressed by room name and participant identity. */
export abstract class VoiceGatewayPort {
  /** A reachability probe, read by `/readyz` while voice is on. */
  abstract checkHealth(): Promise<Result<void, VoiceUnavailable>>;
  /** A join token carrying `grants`, valid for `ttlSeconds` to join. */
  abstract mintToken(request: VoiceTokenRequest): Promise<Result<string, VoiceUnavailable>>;
  /** Replaces the participant's grants in the room; nobody by that identity is a success. */
  abstract updateParticipant(
    room: string,
    identity: string,
    grants: VoiceGrants
  ): Promise<Result<void, VoiceUnavailable>>;
  /** Mutes or unmutes the participant's audio track; no track is a success. */
  abstract muteTrack(
    room: string,
    identity: string,
    muted: boolean
  ): Promise<Result<void, VoiceUnavailable>>;
  /** Disconnects the participant; nobody by that identity is a success. */
  abstract removeParticipant(
    room: string,
    identity: string
  ): Promise<Result<void, VoiceUnavailable>>;
  /** Who is in the room; a room that does not exist is empty. */
  abstract listParticipants(room: string): Promise<Result<VoiceParticipant[], VoiceUnavailable>>;
  /** Checks the signature against the body and reads the event. */
  abstract verifyWebhook(
    body: string,
    authorization: string | undefined
  ): Promise<Result<VoiceWebhookEvent, VoiceWebhookRejected>>;
}
