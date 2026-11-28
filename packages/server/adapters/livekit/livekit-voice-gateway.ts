import { assertNever, err, fromPromise, ok, parseJson, type Result } from '@kit/result';
import {
  type VoiceGrants,
  VoiceGatewayPort,
  type VoiceParticipant,
  type VoiceTokenRequest,
  type VoiceWebhookEvent,
} from '@vp/core/ports';
import {
  type VoiceUnavailable,
  type VoiceWebhookRejected,
  voiceUnavailable,
  voiceWebhookRejected,
} from '@vp/errors';
import {
  AccessToken,
  type ParticipantInfo,
  RoomServiceClient,
  ServerError,
  TrackSource,
  TrackType,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { z } from 'zod';
import { toVoiceWebhookEvent } from './voice-webhook-event';

/** The slice of `RoomServiceClient` this adapter calls, so a spec can hand it a fake. */
export interface VoiceRoomsClient {
  listRooms(names?: string[]): Promise<unknown>;
  listParticipants(room: string): Promise<ParticipantInfo[]>;
  updateParticipant(
    room: string,
    identity: string,
    options: {
      permission: {
        canSubscribe: boolean;
        canPublish: boolean;
        canPublishData: boolean;
        canPublishSources: TrackSource[];
      };
    }
  ): Promise<unknown>;
  mutePublishedTrack(
    room: string,
    identity: string,
    trackSid: string,
    muted: boolean
  ): Promise<unknown>;
  removeParticipant(room: string, identity: string): Promise<unknown>;
}

interface Credentials {
  apiKey: string;
  apiSecret: string;
}

export type LiveKitVoiceGatewayConfig = Credentials &
  (
    | { type: 'connection'; apiUrl: string; timeoutMs: number }
    | { type: 'client'; rooms: VoiceRoomsClient }
  );

function roomsOf(config: LiveKitVoiceGatewayConfig): VoiceRoomsClient {
  switch (config.type) {
    case 'connection':
      return new RoomServiceClient(config.apiUrl, config.apiKey, config.apiSecret, {
        requestTimeout: config.timeoutMs / 1000,
      });
    case 'client':
      return config.rooms;
    default:
      return assertNever(config, 'LiveKitVoiceGatewayConfig');
  }
}

const isNotFound = (cause: unknown) => cause instanceof ServerError && cause.status === 404;

const grantsOf = (info: ParticipantInfo): VoiceGrants => ({
  canSubscribe: info.permission?.canSubscribe ?? false,
  canPublish: info.permission?.canPublish ?? false,
});

const MetadataSchema = z.object({ speak: z.boolean() });

function wantsToSpeak({ metadata }: ParticipantInfo): boolean {
  const parsed = parseJson(metadata);
  const read = parsed.ok ? MetadataSchema.safeParse(parsed.value) : undefined;
  return read?.success === true && read.data.speak;
}

const audioTracks = (info: ParticipantInfo) =>
  info.tracks.filter((track) => track.type === TrackType.AUDIO);

export class LiveKitVoiceGateway extends VoiceGatewayPort {
  private readonly rooms: VoiceRoomsClient;
  private readonly receiver: WebhookReceiver;

  constructor(private readonly config: LiveKitVoiceGatewayConfig) {
    super();
    this.rooms = roomsOf(config);
    this.receiver = new WebhookReceiver(config.apiKey, config.apiSecret);
  }

  async checkHealth(): Promise<Result<void, VoiceUnavailable>> {
    const listed = await this.call('health', (rooms) => rooms.listRooms([]));
    return listed.ok ? ok() : listed;
  }

  mintToken(request: VoiceTokenRequest): Promise<Result<string, VoiceUnavailable>> {
    const { room, identity, name, grants, ttlSeconds } = request;
    return fromPromise(() => {
      const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
        identity,
        name,
        ttl: ttlSeconds,
        metadata: JSON.stringify({ speak: grants.canPublish }),
      });
      token.addGrant({
        roomJoin: true,
        room,
        canSubscribe: grants.canSubscribe,
        canPublish: grants.canPublish,
        canPublishData: false,
        canPublishSources: [TrackSource.MICROPHONE],
      });
      return token.toJwt();
    }, voiceUnavailable.during('mint'));
  }

  async updateParticipant(
    room: string,
    identity: string,
    grants: VoiceGrants
  ): Promise<Result<void, VoiceUnavailable>> {
    const updated = await this.call('update', (rooms) =>
      rooms.updateParticipant(room, identity, {
        permission: {
          canSubscribe: grants.canSubscribe,
          canPublish: grants.canPublish,
          canPublishData: false,
          canPublishSources: grants.canPublish ? [TrackSource.MICROPHONE] : [],
        },
      })
    );
    return updated.ok ? ok() : updated;
  }

  async muteTrack(
    room: string,
    identity: string,
    muted: boolean
  ): Promise<Result<void, VoiceUnavailable>> {
    const listed = await this.participant(room, identity);
    if (!listed.ok || listed.value === null) return listed.ok ? ok() : listed;

    for (const track of audioTracks(listed.value)) {
      const done = await this.call('mute', (rooms) =>
        rooms.mutePublishedTrack(room, identity, track.sid, muted)
      );
      if (!done.ok) return done;
    }
    return ok();
  }

  async removeParticipant(room: string, identity: string): Promise<Result<void, VoiceUnavailable>> {
    const removed = await this.call('remove', (rooms) => rooms.removeParticipant(room, identity));
    return removed.ok ? ok() : removed;
  }

  async listParticipants(room: string): Promise<Result<VoiceParticipant[], VoiceUnavailable>> {
    const listed = await this.call('list', (rooms) => rooms.listParticipants(room));
    if (!listed.ok) return listed;
    return ok(
      (listed.value ?? []).map((info) => ({
        identity: info.identity,
        grants: grantsOf(info),
        publishing: audioTracks(info).length > 0,
        wantsToSpeak: wantsToSpeak(info),
      }))
    );
  }

  async verifyWebhook(
    body: string,
    authorization: string | undefined
  ): Promise<Result<VoiceWebhookEvent, VoiceWebhookRejected>> {
    const received = await fromPromise(
      () => this.receiver.receive(body, authorization),
      () => voiceWebhookRejected('signature')
    );
    if (!received.ok) return received;

    return ok(toVoiceWebhookEvent(received.value));
  }

  private async participant(
    room: string,
    identity: string
  ): Promise<Result<ParticipantInfo | null, VoiceUnavailable>> {
    const listed = await this.call('list', (rooms) => rooms.listParticipants(room));
    if (!listed.ok) return listed;
    return ok(listed.value?.find((info) => info.identity === identity) ?? null);
  }

  private async call<T>(
    operation: string,
    run: (rooms: VoiceRoomsClient) => Promise<T>
  ): Promise<Result<T | null, VoiceUnavailable>> {
    const done = await fromPromise(
      () => run(this.rooms),
      (cause) => cause
    );
    if (done.ok) return ok(done.value);
    return isNotFound(done.error) ? ok(null) : err(voiceUnavailable(operation, done.error));
  }
}
