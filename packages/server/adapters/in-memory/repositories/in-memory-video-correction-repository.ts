import { ok, type Result } from '@kit/result';
import { VideoCorrectionRepository } from '@vp/core/repositories';
import type { Correction } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export class InMemoryVideoCorrectionRepository extends VideoCorrectionRepository {
  private readonly rows = new Map<string, Correction>();

  async list(videoId: string): Promise<Result<Correction[], DatabaseUnavailable>> {
    return ok(this.correctionsOf(videoId));
  }

  correctionsOf(videoId: string): Correction[] {
    return this.ofVideo(videoId).map((row) => ({ ...row }));
  }

  replaceFor(videoId: string, corrections: readonly Correction[]): void {
    for (const row of this.ofVideo(videoId)) this.rows.delete(row.id);
    for (const correction of corrections) this.rows.set(correction.id, { ...correction });
  }

  async create(
    correction: Correction,
    limit: number
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (this.ofVideo(correction.videoId).length >= limit) return ok(false);
    this.rows.set(correction.id, { ...correction });
    return ok(true);
  }

  async update(
    videoId: string,
    correctionId: string,
    fields: Pick<Correction, 'startMs' | 'endMs' | 'text'>
  ): Promise<Result<Correction | null, DatabaseUnavailable>> {
    const found = this.rows.get(correctionId);
    if (found?.videoId !== videoId) return ok(null);
    const updated = { ...found, ...fields };
    this.rows.set(correctionId, updated);
    return ok({ ...updated });
  }

  async remove(
    videoId: string,
    correctionId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const found = this.rows.get(correctionId);
    return ok(found?.videoId === videoId && this.rows.delete(correctionId));
  }

  clear(): void {
    this.rows.clear();
  }

  private ofVideo(videoId: string): Correction[] {
    return [...this.rows.values()]
      .filter((row) => row.videoId === videoId)
      .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  }
}
