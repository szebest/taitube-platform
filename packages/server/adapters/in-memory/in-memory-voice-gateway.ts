import { createHmac, timingSafeEqual } from 'node:crypto';
import { err, ok, parseJson, type Result } from '@kit/result';
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
import { z } from 'zod';
import { toVoiceWebhookEvent } from '../livekit/voice-webhook-event';

interface Seat {
  grants: VoiceGrants;
  wantsToSpeak: boolean;
  muted: boolean;
  publishing: boolean;
}

export interface SignedWebhook {
  readonly body: string;
  readonly authorization: string;
}

const TOKEN_PREFIX = 'twin.';

const WireSchema = z.object({
  event: z.string(),
  room: z.object({ name: z.string() }).optional(),
  participant: z
    .object({
      identity: z.string(),
      permission: z.object({ canPublish: z.boolean().optional() }).optional(),
    })
    .optional(),
});

/**
 * A media server a spec drives: a token minted here is joined with `join`, a participant publishes
 * with `publish`, and a grant the server has dropped refuses it, as the real SFU would.
 */
export class InMemoryVoiceGateway extends VoiceGatewayPort {
  readonly removed: { room: string; identity: string }[] = [];
  private readonly rooms = new Map<string, Map<string, Seat>>();
  private unavailable = false;

  constructor(private readonly secret: string) {
    super();
  }

  setUnavailable(unavailable: boolean): void {
    this.unavailable = unavailable;
  }

  join(token: string): boolean {
    const claims = JSON.parse(token.slice(TOKEN_PREFIX.length)) as VoiceTokenRequest;
    let seats = this.rooms.get(claims.room);
    if (seats === undefined) {
      seats = new Map<string, Seat>();
      this.rooms.set(claims.room, seats);
    }
    seats.set(claims.identity, {
      grants: claims.grants,
      wantsToSpeak: claims.grants.canPublish,
      muted: false,
      publishing: false,
    });
    return true;
  }

  publish(room: string, identity: string): boolean {
    const seat = this.rooms.get(room)?.get(identity);
    if (seat === undefined || !seat.grants.canPublish) return false;
    seat.publishing = true;
    return true;
  }

  isMuted(room: string, identity: string): boolean {
    return this.rooms.get(room)?.get(identity)?.muted ?? false;
  }

  grantsOf(room: string, identity: string): VoiceGrants | undefined {
    return this.rooms.get(room)?.get(identity)?.grants;
  }

  /** LiveKit's wire body for `event`, with the signature this twin accepts. */
  sign(event: Exclude<VoiceWebhookEvent, { type: 'ignored' }>): SignedWebhook {
    const participant =
      event.type === 'participant_joined'
        ? { identity: event.identity, permission: { canPublish: event.canPublish } }
        : { identity: event.identity };
    const body = JSON.stringify({ event: event.type, room: { name: event.room }, participant });
    return { body, authorization: this.signature(body) };
  }

  signBody(body: string): string {
    return this.signature(body);
  }

  async checkHealth(): Promise<Result<void, VoiceUnavailable>> {
    return this.answer(undefined);
  }

  async mintToken(request: VoiceTokenRequest): Promise<Result<string, VoiceUnavailable>> {
    return this.answer(`${TOKEN_PREFIX}${JSON.stringify(request)}`);
  }

  async updateParticipant(
    room: string,
    identity: string,
    grants: VoiceGrants
  ): Promise<Result<void, VoiceUnavailable>> {
    const seat = this.rooms.get(room)?.get(identity);
    if (seat !== undefined) {
      seat.grants = grants;
      if (!grants.canPublish) seat.publishing = false;
    }
    return this.answer(undefined);
  }

  async muteTrack(
    room: string,
    identity: string,
    muted: boolean
  ): Promise<Result<void, VoiceUnavailable>> {
    const seat = this.rooms.get(room)?.get(identity);
    if (seat?.publishing) seat.muted = muted;
    return this.answer(undefined);
  }

  async removeParticipant(room: string, identity: string): Promise<Result<void, VoiceUnavailable>> {
    if (this.rooms.get(room)?.delete(identity)) this.removed.push({ room, identity });
    return this.answer(undefined);
  }

  async listParticipants(room: string): Promise<Result<VoiceParticipant[], VoiceUnavailable>> {
    const seats = [...(this.rooms.get(room) ?? [])];
    return this.answer(
      seats.map(([identity, seat]) => ({
        identity,
        grants: seat.grants,
        publishing: seat.publishing,
        wantsToSpeak: seat.wantsToSpeak,
      }))
    );
  }

  async verifyWebhook(
    body: string,
    authorization: string | undefined
  ): Promise<Result<VoiceWebhookEvent, VoiceWebhookRejected>> {
    const expected = Buffer.from(this.signature(body));
    const presented = Buffer.from(authorization ?? '');
    if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) {
      return err(voiceWebhookRejected('signature'));
    }
    const parsed = parseJson(body);
    const decoded = parsed.ok ? WireSchema.safeParse(parsed.value) : undefined;
    return decoded?.success
      ? ok(toVoiceWebhookEvent(decoded.data))
      : err(voiceWebhookRejected('body'));
  }

  clear(): void {
    this.rooms.clear();
    this.removed.length = 0;
    this.unavailable = false;
  }

  private signature(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('hex');
  }

  private answer<T>(value: T): Result<T, VoiceUnavailable> {
    return this.unavailable ? err(voiceUnavailable('twin')) : ok(value);
  }
}
