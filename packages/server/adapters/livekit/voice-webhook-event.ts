import type { VoiceWebhookEvent } from '@vp/core/ports';

/** The fields of LiveKit's webhook body this repo reads. */
export interface VoiceWebhookWire {
  readonly event: string;
  readonly room?: { readonly name: string } | undefined;
  readonly participant?:
    | {
        readonly identity: string;
        readonly permission?: { readonly canPublish?: boolean } | undefined;
      }
    | undefined;
}

export function toVoiceWebhookEvent({
  event,
  room,
  participant,
}: VoiceWebhookWire): VoiceWebhookEvent {
  if (room === undefined || participant === undefined) return { type: 'ignored' };
  switch (event) {
    case 'participant_joined':
      return {
        type: 'participant_joined',
        room: room.name,
        identity: participant.identity,
        canPublish: participant.permission?.canPublish ?? false,
      };
    case 'participant_left':
      return { type: 'participant_left', room: room.name, identity: participant.identity };
    default:
      return { type: 'ignored' };
  }
}
