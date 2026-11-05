import {
  type LiveCompanionCommand,
  LiveCompanionCommandSchema,
  type LiveCompanionFrame,
} from '@vp/api-contracts';
import type { CacheClient, LiveGatewayPort } from '@vp/core/ports';
import type { LiveStreamRepositoryPort } from '@vp/core/repositories';
import { type LiveStream, liveChatOffsetMs } from '@vp/domain';
import {
  type LiveStreamNotFound,
  type LiveStreamNotLive,
  liveStreamNotFound,
  liveStreamNotLive,
} from '@vp/domain-rules';
import type { DatabaseUnavailable, LiveGatewayUnavailable } from '@vp/errors';
import { assertNever, err, isErr, map, ok, parseJson, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import { haltBroadcast } from './creator-live-service';
import { announceChatMode } from './live-chat-hub';
import { liveChatMode } from './live-views';

export interface LiveCompanionServiceDeps {
  liveStreams: LiveStreamRepositoryPort;
  gateway: LiveGatewayPort;
  cache: Pick<CacheClient, 'publish'>;
  now: () => number;
}

type CommandFailure =
  | InvalidField<{ reason: string }>
  | LiveStreamNotFound
  | LiveStreamNotLive
  | LiveGatewayUnavailable
  | DatabaseUnavailable;

export interface LiveCompanionReply {
  ref?: string;
  result: Result<LiveCompanionFrame, CommandFailure>;
}

function companionStream(stream: LiveStream) {
  return { id: stream.id, status: stream.status, chat: liveChatMode(stream) };
}

/**
 * A Stream Deck's side of a broadcast, keyed by the control token. The token moves to the next
 * stream when a broadcast ends, so every command finds its stream again rather than keep the first.
 */
export class LiveCompanionService {
  constructor(private readonly deps: LiveCompanionServiceDeps) {}

  async open(
    token: string
  ): Promise<Result<LiveCompanionFrame, LiveStreamNotFound | DatabaseUnavailable>> {
    return map(await this.stream(token), (stream) => ({
      type: 'hello' as const,
      stream: companionStream(stream),
    }));
  }

  async receive(token: string, raw: string): Promise<LiveCompanionReply> {
    const decoded = parseJson(raw);
    const command = isErr(decoded) ? null : LiveCompanionCommandSchema.safeParse(decoded.value);
    if (!command?.success) {
      return {
        result: err(invalidField('command', 'Not a companion command', { reason: 'unreadable' })),
      };
    }

    const { data } = command;
    const stream = await this.stream(token);
    const done = isErr(stream) ? stream : await this.run(stream.value, data);
    return {
      ref: data.ref,
      result: map(done, (after) => ({
        type: 'ack' as const,
        ref: data.ref,
        command: data.type,
        stream: companionStream(after),
      })),
    };
  }

  private async run(
    stream: LiveStream,
    command: LiveCompanionCommand
  ): Promise<Result<LiveStream, Exclude<CommandFailure, InvalidField<{ reason: string }>>>> {
    const { liveStreams, now } = this.deps;
    switch (command.type) {
      case 'stop':
        return stream.status === 'LIVE'
          ? haltBroadcast(this.deps, stream)
          : err(liveStreamNotLive(stream.id));
      case 'chat.mode': {
        const { slowModeSeconds, subscribersOnly } = command;
        const updated = await liveStreams.update(stream.id, {
          ...(slowModeSeconds === undefined ? {} : { chatSlowModeSeconds: slowModeSeconds }),
          ...(subscribersOnly === undefined ? {} : { chatSubscribersOnly: subscribersOnly }),
        });
        if (isErr(updated)) return updated;
        if (updated.value === null) return err(liveStreamNotFound(stream.id));
        await announceChatMode(this.deps.cache, updated.value);
        return ok(updated.value);
      }
      case 'marker': {
        if (stream.status !== 'LIVE' || stream.startedAt === null) {
          return err(liveStreamNotLive(stream.id));
        }
        const offsetMs = liveChatOffsetMs(stream.startedAt, new Date(now()));
        const marked = await liveStreams.addMarker(stream.id, {
          offsetMs,
          label: command.label ?? '',
        });
        if (isErr(marked)) return marked;
        return marked.value ? ok(marked.value) : err(liveStreamNotLive(stream.id));
      }
      default:
        return assertNever(command, 'LiveCompanionCommand');
    }
  }

  private async stream(
    token: string
  ): Promise<Result<LiveStream, LiveStreamNotFound | DatabaseUnavailable>> {
    const found = await this.deps.liveStreams.findByToken('control', token);
    if (isErr(found)) return found;
    return found.value ? ok(found.value) : err(liveStreamNotFound('companion'));
  }
}
