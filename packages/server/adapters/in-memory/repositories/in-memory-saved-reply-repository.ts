import type { SavedReplyDraft, SavedReplyRepositoryPort } from '@vp/core/repositories';
import type { SavedReply } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export class InMemorySavedReplyRepository implements SavedReplyRepositoryPort {
  private readonly rows = new Map<string, SavedReply>();

  async list(channelId: string): Promise<Result<SavedReply[], DatabaseUnavailable>> {
    return ok(this.ofChannel(channelId).map((row) => ({ ...row })));
  }

  async create(
    channelId: string,
    draft: SavedReplyDraft,
    limit: number
  ): Promise<Result<SavedReply | null, DatabaseUnavailable>> {
    const existing = this.ofChannel(channelId);
    if (existing.length >= limit) return ok(null);
    const position = Math.max(-1, ...existing.map((row) => row.position)) + 1;
    const row: SavedReply = { id: uuidv7(), channelId, ...draft, position };
    this.rows.set(row.id, row);
    return ok({ ...row });
  }

  async update(
    channelId: string,
    id: string,
    patch: Partial<SavedReplyDraft & { position: number }>
  ): Promise<Result<SavedReply | null, DatabaseUnavailable>> {
    const row = this.rows.get(id);
    if (row?.channelId !== channelId) return ok(null);
    Object.assign(row, patch);
    return ok({ ...row });
  }

  async remove(channelId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const row = this.rows.get(id);
    return ok(row?.channelId === channelId && this.rows.delete(id));
  }

  clear(): void {
    this.rows.clear();
  }

  private ofChannel(channelId: string): SavedReply[] {
    return [...this.rows.values()]
      .filter((row) => row.channelId === channelId)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }
}
