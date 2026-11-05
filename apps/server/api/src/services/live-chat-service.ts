import {
  type LiveChatBroadcast,
  LiveChatClientFrameSchema,
  type LiveChatServerFrame,
} from '@vp/api-contracts';
import type { CacheClient, LiveChatGatePort } from '@vp/core/ports';
import type { LiveChatRepositoryPort, SubscriptionRepositoryPort } from '@vp/core/repositories';
import { type LiveStream, liveChatOffsetMs } from '@vp/domain';
import {
  type AuthorizationFailure,
  decideLiveChatModerate,
  decideLiveChatPost,
  type LiveChatClosed,
  type LiveChatSlowMode,
  type LiveChatSubscribersOnly,
  type LiveChatTicketInvalid,
  liveChatSlowMode,
  liveChatTicketInvalid,
  liveStreamNotFound,
  type LiveStreamNotFound,
} from '@vp/domain-rules';
import type { LiveChatTuning } from '@vp/env-schema';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  ErrorCodes,
  type Failure,
} from '@vp/errors';
import { canModerateLiveStream, type UserContext } from '@vp/permissions';
import { assertNever, err, ignore, isErr, map, ok, parseJson, type Result } from '@vp/result';
import {
  type InvalidField,
  type InvalidLiveChatMessage,
  invalidField,
  validateLiveChatMessage,
} from '@vp/validation';
import { uuidv7 } from 'uuidv7';
import { type LiveAccessDeps, type ReadLiveFailure, readLive } from './live-access';
import { readLiveChatBacklog } from './live-chat-backlog';
import { type LiveChatHub, publishLiveChat } from './live-chat-hub';
import { liveChatMode, toLiveChatMessageView } from './live-views';

export interface LiveChatServiceDeps extends LiveAccessDeps {
  liveChat: LiveChatRepositoryPort;
  subscriptions: Pick<SubscriptionRepositoryPort, 'isSubscribed'>;
  gate: LiveChatGatePort;
  hub: LiveChatHub;
  cache: Pick<CacheClient, 'publish'>;
  /** `CORS_ORIGINS`: a browser socket from anywhere else is refused, as its fetches would be. */
  allowedOrigins: readonly string[];
  tuning: LiveChatTuning;
  newTicket: () => string;
  now: () => number;
}

/** Who a socket is: read-only unless it opened with a one-time token. */
export interface LiveChatSession {
  liveStreamId: string;
  viewer: UserContext | null;
  ownerId: string;
  stream: LiveStream;
}

type OriginRefused = Failure<typeof ErrorCodes.FORBIDDEN, { origin: string }>;

export type OpenLiveChatFailure =
  | ReadLiveFailure
  | LiveChatTicketInvalid
  | OriginRefused
  | CacheUnavailable;

type SendFailure =
  | LiveChatTicketInvalid
  | InvalidLiveChatMessage
  | LiveStreamNotFound
  | LiveChatClosed
  | LiveChatSubscribersOnly
  | LiveChatSlowMode
  | DatabaseUnavailable
  | CacheUnavailable;

type RemoveFailure = LiveChatTicketInvalid | AuthorizationFailure | DatabaseUnavailable;

type FrameFailure = InvalidField<{ reason: string }> | SendFailure | RemoveFailure;

export interface LiveChatReply {
  ref?: string;
  result: Result<LiveChatServerFrame, FrameFailure>;
}

export interface LiveChatConnection {
  receive(raw: string): Promise<LiveChatReply>;
  leave(): void;
}

export class LiveChatService {
  constructor(private readonly deps: LiveChatServiceDeps) {}

  async issueTicket(
    viewer: UserContext,
    liveStreamId: string
  ): Promise<Result<{ ticket: string; expiresAt: string }, ReadLiveFailure | CacheUnavailable>> {
    const { gate, tuning, newTicket, now } = this.deps;
    const watchable = await readLive(this.deps, viewer, liveStreamId);
    if (isErr(watchable)) return watchable;

    const ticket = newTicket();
    const grant = { userId: viewer.id, role: viewer.role, liveStreamId };
    return map(await gate.issueTicket(ticket, grant, tuning.ticketTtlSeconds), () => ({
      ticket,
      expiresAt: new Date(now() + tuning.ticketTtlSeconds * 1000).toISOString(),
    }));
  }

  /** Runs before the upgrade, so a refusal is a plain HTTP Problem rather than a dead socket. */
  async open(input: {
    liveStreamId: string;
    ticket?: string;
    origin?: string;
  }): Promise<Result<LiveChatSession, OpenLiveChatFailure>> {
    const { liveStreamId, ticket, origin } = input;
    if (origin !== undefined && !this.deps.allowedOrigins.includes(origin)) {
      return err({ code: ErrorCodes.FORBIDDEN, message: 'Origin not allowed', origin });
    }

    let viewer: UserContext | null = null;
    if (ticket !== undefined) {
      const grant = await this.deps.gate.redeemTicket(ticket);
      if (isErr(grant)) return grant;
      if (grant.value?.liveStreamId !== liveStreamId) return err(liveChatTicketInvalid());
      viewer = { id: grant.value.userId, role: grant.value.role };
    }

    const watchable = await readLive(this.deps, viewer, liveStreamId);
    if (isErr(watchable)) return watchable;
    const { stream, channel } = watchable.value;
    return ok({ liveStreamId, viewer, ownerId: channel.userId, stream });
  }

  /**
   * Joins the hub before reading the backlog, so a line sent in between arrives either way, then
   * drops the copy: the backlog goes out first and the lines that came during it after, once each.
   */
  async connect(
    session: LiveChatSession,
    after: string | null,
    send: (frame: LiveChatServerFrame) => void
  ): Promise<Result<LiveChatConnection, DatabaseUnavailable | CacheUnavailable>> {
    const { liveChat, hub, tuning } = this.deps;
    const subscribed = await hub.init();
    if (isErr(subscribed)) return subscribed;
    const held: LiveChatBroadcast[] = [];
    let sending = false;
    const leave = hub.join(session.liveStreamId, (event) => {
      if (sending) send(event);
      else held.push(event);
    });

    const backlog = await readLiveChatBacklog(
      liveChat,
      session.liveStreamId,
      after,
      tuning.resumeLimit
    );
    if (isErr(backlog)) {
      leave();
      return backlog;
    }

    const { viewer, stream, ownerId } = session;
    send({
      type: 'hello',
      resume: backlog.value.resume,
      mode: liveChatMode(stream),
      canSend: viewer !== null,
      canModerate: canModerateLiveStream({ user: viewer, stream: { ownerId } }),
    });
    const sent = new Set<string>();
    for (const line of backlog.value.lines) {
      sent.add(line.id);
      send({ type: 'message', message: toLiveChatMessageView(line) });
    }
    for (const event of held) {
      if (!(event.type === 'message' && sent.has(event.message.id))) send(event);
    }
    sending = true;

    return ok({ receive: (raw) => this.receive(session, raw), leave });
  }

  private async receive(session: LiveChatSession, raw: string): Promise<LiveChatReply> {
    const decoded = parseJson(raw);
    const frame = isErr(decoded) ? null : LiveChatClientFrameSchema.safeParse(decoded.value);
    if (!frame?.success) {
      return { result: err(invalidField('frame', 'Not a chat frame', { reason: 'unreadable' })) };
    }

    const { data } = frame;
    const acked = (id: string): LiveChatServerFrame => ({ type: 'ack', ref: data.ref, id });
    switch (data.type) {
      case 'send':
        return { ref: data.ref, result: map(await this.send(session, data.message), acked) };
      case 'remove':
        return { ref: data.ref, result: map(await this.remove(session, data.id), acked) };
      default:
        return assertNever(data, 'LiveChatClientFrame');
    }
  }

  /** The line is stored before it is published, so a reconnect's backlog never misses one. */
  private async send(session: LiveChatSession, text: string): Promise<Result<string, SendFailure>> {
    const { liveStreams, liveChat, subscriptions, gate, tuning, now } = this.deps;
    const { viewer, liveStreamId, ownerId } = session;
    if (viewer === null) return err(liveChatTicketInvalid());

    const message = validateLiveChatMessage(text);
    if (isErr(message)) return message;
    const stream = await liveStreams.findById(liveStreamId);
    if (isErr(stream)) return stream;
    if (stream.value === null) return err(liveStreamNotFound(liveStreamId));

    const subscribed = stream.value.chatSubscribersOnly
      ? await subscriptions.isSubscribed(viewer.id, stream.value.channelId)
      : ok(true);
    if (isErr(subscribed)) return subscribed;
    const grant = decideLiveChatPost({
      actor: viewer,
      stream: stream.value,
      ownerId,
      isSubscriber: subscribed.value,
    });
    if (isErr(grant)) return grant;

    const admission = await gate.admit(liveStreamId, viewer.id, {
      slowModeSeconds: grant.value.slowModeSeconds,
      burst: tuning.burst,
    });
    if (isErr(admission)) return admission;
    if (admission.value.type === 'refused') {
      return err(liveChatSlowMode(admission.value.retryAfterSeconds));
    }

    const at = new Date(now());
    const appended = await liveChat.append({
      id: uuidv7(),
      liveStreamId,
      userId: viewer.id,
      message: message.value,
      offsetMs: liveChatOffsetMs(stream.value.startedAt ?? at, at),
      createdAt: at,
    });
    if (isErr(appended)) return appended;
    ignore(
      await publishLiveChat(this.deps.cache, liveStreamId, {
        type: 'message',
        message: toLiveChatMessageView(appended.value),
      }),
      'the line is stored, so a socket that missed the publish gets it on its next resume'
    );
    return ok(appended.value.id);
  }

  private async remove(
    session: LiveChatSession,
    messageId: string
  ): Promise<Result<string, RemoveFailure>> {
    const { viewer, stream, ownerId, liveStreamId } = session;
    if (viewer === null) return err(liveChatTicketInvalid());
    const allowed = decideLiveChatModerate({ actor: viewer, stream, ownerId });
    if (isErr(allowed)) return allowed;

    const removed = await this.deps.liveChat.remove(
      liveStreamId,
      messageId,
      new Date(this.deps.now())
    );
    if (isErr(removed)) return removed;
    if (removed.value) {
      ignore(
        await publishLiveChat(this.deps.cache, liveStreamId, { type: 'removed', id: messageId }),
        'the line is gone from every read, so a socket that missed this drops it on reload'
      );
    }
    return ok(messageId);
  }
}
