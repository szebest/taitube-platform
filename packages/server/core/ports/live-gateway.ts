import type { LiveGatewayUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/** The ingest server's control plane, addressed by the path a publisher sends on (`live/{key}`). */
export abstract class LiveGatewayPort {
  /** Whether a publisher is sending on `path` right now. */
  abstract isPublishing(path: string): Promise<Result<boolean, LiveGatewayUnavailable>>;
  /** Drops the publisher on `path`; nobody publishing there is a success. */
  abstract kick(path: string): Promise<Result<void, LiveGatewayUnavailable>>;
}
