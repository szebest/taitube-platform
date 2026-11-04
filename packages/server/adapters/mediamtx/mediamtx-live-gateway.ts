import { LiveGatewayPort } from '@vp/core/ports';
import { type LiveGatewayUnavailable, liveGatewayUnavailable } from '@vp/errors';
import { err, fromPromise, ok, type Result } from '@vp/result';
import { z } from 'zod';

export interface MediaMtxLiveGatewayConfig {
  /** The control API's origin, `http://mediamtx:9997`. */
  apiUrl: string;
  timeoutMs: number;
}

/** MediaMTX v1 `GET /v3/paths/get/{name}`: the fields this adapter reads, the rest ignored. */
const PathSchema = z.object({
  ready: z.boolean(),
  source: z.object({ type: z.string(), id: z.string() }).nullable(),
});

/** The control endpoint that drops each kind of publisher, keyed by the `source.type` MediaMTX reports. */
const KICK_COLLECTION: Readonly<Record<string, string>> = {
  rtmpConn: 'rtmpconns',
  rtmpsConn: 'rtmpsconns',
  webRTCSession: 'webrtcsessions',
  rtspSession: 'rtspsessions',
  rtspsSession: 'rtspssessions',
  srtConn: 'srtconns',
};

type Path = z.infer<typeof PathSchema>;

export class MediaMtxLiveGateway extends LiveGatewayPort {
  constructor(
    private readonly config: MediaMtxLiveGatewayConfig,
    private readonly send: typeof fetch
  ) {
    super();
  }

  async isPublishing(path: string): Promise<Result<boolean, LiveGatewayUnavailable>> {
    const found = await this.path(path);
    return found.ok ? ok(found.value?.ready === true) : found;
  }

  async kick(path: string): Promise<Result<void, LiveGatewayUnavailable>> {
    const found = await this.path(path);
    if (!found.ok) return found;
    const source = found.value?.source;
    const collection = source ? KICK_COLLECTION[source.type] : undefined;
    if (!(source && collection)) return ok();

    const kicked = await this.call('kick', `/v3/${collection}/kick/${source.id}`, 'POST');
    if (!kicked.ok) return kicked;
    return kicked.value.ok || kicked.value.status === 404
      ? ok()
      : err(liveGatewayUnavailable('kick', `status ${kicked.value.status}`));
  }

  private async path(path: string): Promise<Result<Path | null, LiveGatewayUnavailable>> {
    const answered = await this.call('paths', `/v3/paths/get/${path}`, 'GET');
    if (!answered.ok) return answered;
    const response = answered.value;
    if (response.status === 404) return ok(null);
    if (!response.ok) return err(liveGatewayUnavailable('paths', `status ${response.status}`));

    const body = await fromPromise(
      () => response.json(),
      (cause) => liveGatewayUnavailable('paths', cause)
    );
    if (!body.ok) return body;
    const parsed = PathSchema.safeParse(body.value);
    return parsed.success ? ok(parsed.data) : err(liveGatewayUnavailable('paths', parsed.error));
  }

  private async call(
    operation: string,
    route: string,
    method: 'GET' | 'POST'
  ): Promise<Result<Response, LiveGatewayUnavailable>> {
    return fromPromise(
      () =>
        this.send(new URL(route, this.config.apiUrl), {
          method,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        }),
      (cause) => liveGatewayUnavailable(operation, cause)
    );
  }
}
