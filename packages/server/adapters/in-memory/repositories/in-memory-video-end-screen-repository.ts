import { ok, type Result } from '@kit/result';
import type { EndScreenDraft, VideoEndScreenRepositoryPort } from '@vp/core/repositories';
import type { EndScreen } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export class InMemoryVideoEndScreenRepository implements VideoEndScreenRepositoryPort {
  private readonly screens = new Map<string, EndScreen>();

  async find(videoId: string): Promise<Result<EndScreen | null, DatabaseUnavailable>> {
    return ok(this.screens.get(videoId) ?? null);
  }

  async replace(
    draft: EndScreenDraft,
    expectedVersion: number
  ): Promise<Result<EndScreen | null, DatabaseUnavailable>> {
    const held = this.screens.get(draft.videoId);
    if ((held?.version ?? 0) !== expectedVersion) return ok(null);
    const saved = { ...draft, version: expectedVersion + 1 };
    this.screens.set(draft.videoId, saved);
    return ok(saved);
  }

  clear(): void {
    this.screens.clear();
  }
}
