import type { Container } from '@kit/composition';
import { createTraceparent, getActiveTraceparent } from '@kit/observability';
import { Adapters } from '@vp/adapters/composition';
import {
  ClipSuggestionService,
  VideoEditsService,
  VideoReplacementService,
} from '../services/index';
import { Services } from './service-tokens';

const traceparent = () => getActiveTraceparent() ?? createTraceparent();

/** Replacing a file, trimming and blurring it, and the clip suggestions read off its retention. */
export function registerVideoPipelineServices(c: Container): Container {
  const repositories = () => c.get(Adapters.Repositories);
  const config = () => c.get(Adapters.Config);

  return c
    .provide(
      Services.VideoReplacementService,
      (c) =>
        new VideoReplacementService({
          videos: repositories().videos,
          generations: repositories().videoGenerations,
          storage: c.get(Adapters.Storage),
          rawBucket: config().buckets.raw,
          maxUploadBytes: config().limits.maxUploadBytes,
          presignedUrlTtlSeconds: config().limits.presignTtlSeconds,
          traceparent,
          now: Date.now,
        })
    )
    .provide(
      Services.VideoEditsService,
      () =>
        new VideoEditsService({
          videos: repositories().videos,
          generations: repositories().videoGenerations,
          traceparent,
          now: Date.now,
        })
    )
    .provide(
      Services.ClipSuggestionService,
      () =>
        new ClipSuggestionService({
          videos: repositories().videos,
          views: repositories().videoViews,
          chapters: repositories().videoChapters,
        })
    );
}
