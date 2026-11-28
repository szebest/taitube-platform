import { ok, type Result } from '@kit/result';
import type { ContentLinkDismissalRepositoryPort } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';

export class InMemoryContentLinkDismissalRepository implements ContentLinkDismissalRepositoryPort {
  private readonly keys = new Map<string, Set<string>>();

  async dismiss(
    channelId: string,
    suggestionKey: string,
    _dismissedBy: string
  ): Promise<Result<void, DatabaseUnavailable>> {
    const held = this.keys.get(channelId) ?? new Set<string>();
    held.add(suggestionKey);
    this.keys.set(channelId, held);
    return ok();
  }

  async dismissedKeys(channelId: string): Promise<Result<Set<string>, DatabaseUnavailable>> {
    return ok(new Set(this.keys.get(channelId)));
  }

  clear(): void {
    this.keys.clear();
  }
}
