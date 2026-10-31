import type { PickRange, PickRepositoryPort, PickWriteFailure } from '@vp/core/repositories';
import type { EditorPick, EditorPickEntry } from '@vp/domain';
import { type DatabaseUnavailable, pickWindowOverlap } from '@vp/errors';
import { err, ok, type Result, unwrapOr } from '@vp/result';
import { channelCard, type VideoLookups } from './watchable-video';

interface Window {
  startsAt: Date;
  endsAt: Date;
}

const overlaps = (a: Window, b: Window) =>
  a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();

const byStart = (a: EditorPick, b: EditorPick) => a.startsAt.getTime() - b.startsAt.getTime();

export class InMemoryPickRepository implements PickRepositoryPort {
  private readonly rows = new Map<string, EditorPick>();

  constructor(private readonly lookups: VideoLookups) {}

  async create(pick: EditorPick): Promise<Result<void, PickWriteFailure>> {
    if (this.holder(pick, pick.id)) return err(pickWindowOverlap(pick.startsAt, pick.endsAt));
    this.rows.set(pick.id, { ...pick });
    return ok();
  }

  async update(pick: EditorPick): Promise<Result<boolean, PickWriteFailure>> {
    if (!this.rows.has(pick.id)) return ok(false);
    if (this.holder(pick, pick.id)) return err(pickWindowOverlap(pick.startsAt, pick.endsAt));
    this.rows.set(pick.id, { ...pick });
    return ok(true);
  }

  async findById(id: string): Promise<Result<EditorPick | null, DatabaseUnavailable>> {
    const found = this.rows.get(id);
    return ok(found ? { ...found } : null);
  }

  async findOverlapping(
    window: Window,
    exceptId?: string
  ): Promise<Result<EditorPick | null, DatabaseUnavailable>> {
    const found = this.holder(window, exceptId);
    return ok(found ? { ...found } : null);
  }

  async findCurrent(at: Date): Promise<Result<EditorPickEntry | null, DatabaseUnavailable>> {
    const instant = { startsAt: at, endsAt: new Date(at.getTime() + 1) };
    const [found = null] = await this.entries(
      [...this.rows.values()].filter((pick) => overlaps(pick, instant))
    );
    return ok(found);
  }

  async listBetween({
    from,
    to,
  }: PickRange): Promise<Result<EditorPickEntry[], DatabaseUnavailable>> {
    const touching = [...this.rows.values()]
      .filter((pick) => overlaps(pick, { startsAt: from, endsAt: to }))
      .sort(byStart);
    return ok(await this.entries(touching));
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.rows.delete(id));
  }

  clear(): void {
    this.rows.clear();
  }

  private holder(window: Window, exceptId?: string): EditorPick | undefined {
    return [...this.rows.values()].find((pick) => pick.id !== exceptId && overlaps(pick, window));
  }

  /** A pick whose video is gone drops out, as the foreign key's cascade would have removed it. */
  private async entries(picks: readonly EditorPick[]): Promise<EditorPickEntry[]> {
    const entries: EditorPickEntry[] = [];
    for (const pick of picks) {
      const video = unwrapOr(await this.lookups.videosRepo.findById(pick.videoId), null);
      if (!video) continue;
      const channel = await channelCard(this.lookups, video.ownerId);
      entries.push({ pick: { ...pick }, video, channel });
    }
    return entries;
  }
}
