import type { DatabaseUnavailable } from '@kit/errors';
import { ok, type Result } from '@kit/result';
import { VideoChapterRepository } from '@vp/core/repositories';
import type { Chapter } from '@vp/domain';

export class InMemoryVideoChapterRepository extends VideoChapterRepository {
  private readonly rows = new Map<string, Chapter[]>();

  async listFor(
    videoIds: readonly string[]
  ): Promise<Result<Map<string, Chapter[]>, DatabaseUnavailable>> {
    return ok(new Map(videoIds.map((id) => [id, this.chaptersOf(id)])));
  }

  chaptersOf(videoId: string): Chapter[] {
    return (this.rows.get(videoId) ?? []).map((chapter) => ({ ...chapter }));
  }

  replace(videoId: string, chapters: readonly Chapter[]): void {
    this.rows.set(
      videoId,
      chapters.map((chapter) => ({ ...chapter }))
    );
  }

  clear(): void {
    this.rows.clear();
  }
}
