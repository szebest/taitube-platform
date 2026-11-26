import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import {
  ChapterService,
  CreatorStudioService,
  VideoBulkEditService,
  VideoCorrectionService,
  VideoRevisionService,
} from '../services/index';
import { Services } from './service-tokens';

export function registerStudioServices(c: Container): Container {
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(
      Services.CreatorStudioService,
      (c) =>
        new CreatorStudioService({
          videos: repositories().videos,
          studio: repositories().videoStudio,
          videoService: c.get(Services.VideoService),
          metadataScreening: c.get(Services.MetadataScreening),
          channels: repositories().channels,
          cdn: c.get(Adapters.Config).cdn,
          sprite: c.get(Adapters.Config).sprite,
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.VideoBulkEditService,
      (c) =>
        new VideoBulkEditService({
          videos: repositories().videos,
          studio: c.get(Services.CreatorStudioService),
        })
    )
    .provide(
      Services.VideoRevisionService,
      (c) =>
        new VideoRevisionService({
          videos: repositories().videos,
          revisions: repositories().entityRevisions,
          chapters: repositories().videoChapters,
          studio: c.get(Services.CreatorStudioService),
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.ChapterService,
      (c) =>
        new ChapterService({
          videos: repositories().videos,
          captions: repositories().captions,
          studio: c.get(Services.CreatorStudioService),
        })
    )
    .provide(
      Services.VideoCorrectionService,
      (c) =>
        new VideoCorrectionService({
          videos: repositories().videos,
          corrections: repositories().videoCorrections,
          gate: c.get(Services.VideoAccessGate),
          now: Date.now,
        })
    );
}
