import type { LiveStream } from '@vp/domain';
import { err, ok, type Result } from '@vp/result';
import { type LiveIngestRefused, liveIngestRefused } from './failures';
import { LIVE_STREAM } from './live-stream.machine';

/** The one account that reads a publisher's stream back from the gateway: the live worker. */
export const LIVE_READER_USER = 'vp-worker';

/** What MediaMTX asks its HTTP auth hook, the fields a decision reads. */
export interface LiveGatewayCall {
  readonly action: string;
  readonly path: string;
  readonly user: string;
  readonly password: string;
}

export interface LiveGatewayCallInput {
  /** `LIVE_HOOK_SECRET`; absent refuses every call, so an unconfigured ingest admits nobody. */
  readonly configuredSecret: string | undefined;
  readonly presentedSecret: string | undefined;
  readonly call: LiveGatewayCall;
  /** The stream the published path's key names, when it names one. */
  readonly stream: LiveStream | null;
}

export type LiveGatewayVerdict =
  | { readonly type: 'go-live'; readonly stream: LiveStream }
  | { readonly type: 'admit' };

/**
 * Compares in time that depends on the length only, so a caller cannot learn a secret byte by byte
 * from how fast a wrong guess is refused. Runs in a browser too, hence no `node:crypto`.
 */
function sameSecret(presented: string, expected: string): boolean {
  let difference = presented.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= (presented.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * A publisher on an `IDLE` stream's key takes it live; one reconnecting to a `LIVE` stream carries
 * on, unless the creator stopped it. Reading is for the live worker alone, and nothing else is admitted.
 */
export function decideLiveGatewayCall(
  input: LiveGatewayCallInput
): Result<LiveGatewayVerdict, LiveIngestRefused> {
  const { configuredSecret, presentedSecret, call, stream } = input;
  if (!(configuredSecret && sameSecret(presentedSecret ?? '', configuredSecret))) {
    return err(liveIngestRefused('hook-secret'));
  }

  switch (call.action) {
    case 'publish':
      if (stream === null) return err(liveIngestRefused('unknown-key'));
      if (LIVE_STREAM.next(stream.status, 'goLive')) return ok({ type: 'go-live', stream });
      if (!LIVE_STREAM.next(stream.status, 'end')) return err(liveIngestRefused('not-idle'));
      return stream.stopRequestedAt === null
        ? ok({ type: 'admit' })
        : err(liveIngestRefused('stopping'));
    case 'read':
      return call.user === LIVE_READER_USER && sameSecret(call.password, configuredSecret)
        ? ok({ type: 'admit' })
        : err(liveIngestRefused('reader'));
    default:
      return err(liveIngestRefused('action'));
  }
}
