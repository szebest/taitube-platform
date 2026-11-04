import { LiveGatewayPort } from '@vp/core/ports';
import type { LiveGatewayUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

/** A gateway whose publishers a spec sets: `publish` puts one on a path, a kick takes it off. */
export class InMemoryLiveGateway extends LiveGatewayPort {
  readonly kicked: string[] = [];
  private readonly publishing = new Set<string>();

  publish(path: string): void {
    this.publishing.add(path);
  }

  async isPublishing(path: string): Promise<Result<boolean, LiveGatewayUnavailable>> {
    return ok(this.publishing.has(path));
  }

  async kick(path: string): Promise<Result<void, LiveGatewayUnavailable>> {
    if (this.publishing.delete(path)) this.kicked.push(path);
    return ok();
  }

  clear(): void {
    this.publishing.clear();
    this.kicked.length = 0;
  }
}
