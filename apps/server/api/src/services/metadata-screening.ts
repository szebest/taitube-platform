import type { ScreeningRepository, VideoRecord, VideoRepository } from '@vp/core/repositories';
import type { ScreeningThresholds } from '@vp/domain';
import { screenMetadataInLocales } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface MetadataScreeningDeps {
  screenings: Pick<ScreeningRepository, 'raiseFlag'>;
  videos: Pick<VideoRepository, 'listByOwner'>;
  enabled: boolean;
  thresholds: ScreeningThresholds;
  locales: readonly string[];
  recentTitleCount: number;
}

/** A flag has somewhere to go on a public video and on one already in the queue. */
const flaggable = ({ status }: VideoRecord): boolean => status === 'READY' || status === 'HELD';

/**
 * Runs the metadata rules over a video's edited title, description and tags and raises a flag for
 * a moderator. It never changes the state of the video: the creator's edit is already saved.
 */
export class MetadataScreening {
  constructor(private readonly deps: MetadataScreeningDeps) {}

  async flag(video: VideoRecord): Promise<Result<boolean, DatabaseUnavailable>> {
    const { enabled, thresholds, locales, recentTitleCount } = this.deps;
    if (!(enabled && flaggable(video))) return ok(false);

    const recent = await this.deps.videos.listByOwner({
      ownerId: video.ownerId,
      viewer: { id: video.ownerId, role: 'USER' },
      limit: recentTitleCount,
    });
    if (isErr(recent)) return recent;

    const finding = screenMetadataInLocales(
      {
        title: video.title ?? '',
        description: video.description,
        tags: video.tags ?? [],
        recentTitles: recent.value
          .filter((other) => other.id !== video.id)
          .map((other) => other.title ?? ''),
      },
      locales,
      thresholds
    );
    if (!finding) return ok(false);

    return this.deps.screenings.raiseFlag({
      id: uuidv7(),
      videoId: video.id,
      finding,
      thresholdVersion: thresholds.version,
    });
  }
}
