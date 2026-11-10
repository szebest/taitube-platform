import type { ChannelHandleHistoryRepositoryPort } from '@vp/core/repositories';
import type { ChannelHandleRetirement } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

/** Written by `InMemoryChannelRepository.update`, as the postgres channel update writes the table. */
export class InMemoryChannelHandleHistoryRepository implements ChannelHandleHistoryRepositoryPort {
  private readonly retired = new Map<string, ChannelHandleRetirement>();

  retire(entry: ChannelHandleRetirement): void {
    this.retired.set(entry.handle.toLowerCase(), { ...entry });
  }

  release(handle: string): void {
    this.retired.delete(handle.toLowerCase());
  }

  async findByHandle(
    handle: string
  ): Promise<Result<ChannelHandleRetirement | null, DatabaseUnavailable>> {
    const found = this.retired.get(handle.toLowerCase());
    return ok(found ? { ...found } : null);
  }

  async purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    let removed = 0;
    for (const [handle, entry] of this.retired) {
      if (entry.retiredAt < cutoff) {
        this.retired.delete(handle);
        removed += 1;
      }
    }
    return ok(removed);
  }

  clear(): void {
    this.retired.clear();
  }
}
