import type { VideoRepository, VideoRecord } from '@vp/core/repositories';
import type { ScreeningFinding, ScreeningThresholds } from '@vp/domain';
import { screenMetadata } from '@vp/domain-rules';
import type { ScreeningConfig } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';

/**
 * Title, description and tags against the profanity lists and the spam signals, once per language the
 * platform serves (a video carries no language of its own), keeping the strongest hit. The creator's
 * latest titles are what the same-title check compares with.
 */
export async function metadataFinding(
  videos: Pick<VideoRepository, 'listByOwner'>,
  video: VideoRecord,
  thresholds: ScreeningThresholds,
  process: Pick<ScreeningConfig['process'], 'metadataLocales' | 'recentTitleCount'>
): Promise<Result<ScreeningFinding | null, DatabaseUnavailable>> {
  const recent = await videos.listByOwner({
    ownerId: video.ownerId,
    viewer: { id: video.ownerId, role: 'USER' },
    limit: process.recentTitleCount,
  });
  if (isErr(recent)) return recent;

  const recentTitles = recent.value
    .filter((other) => other.id !== video.id)
    .map((other) => other.title ?? '');
  const findings = process.metadataLocales.map((locale) =>
    screenMetadata(
      {
        title: video.title ?? '',
        description: video.description,
        tags: video.tags ?? [],
        locale,
        recentTitles,
      },
      thresholds
    )
  );
  const strongest = findings
    .filter((finding): finding is ScreeningFinding => finding !== null)
    .sort((a, b) => b.score - a.score)[0];
  return ok(strongest ?? null);
}
