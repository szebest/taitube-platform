import type { ChannelPageRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { ChannelLocalization, ChannelPageSettings } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';

interface PageRow {
  settings: ChannelPageSettings;
  localizations: ChannelLocalization[];
}

export class InMemoryChannelPageRepository implements ChannelPageRepositoryPort {
  private readonly pages = new Map<string, PageRow>();

  constructor(private readonly videos: Pick<VideoRepository, 'findById'>) {}

  async getSettings(channelId: string): Promise<Result<ChannelPageSettings, DatabaseUnavailable>> {
    const settings = this.pages.get(channelId)?.settings;
    return ok(settings ? { ...settings } : { trailerVideoId: null, returningVideoId: null });
  }

  async listLocalizations(
    channelId: string
  ): Promise<Result<ChannelLocalization[], DatabaseUnavailable>> {
    const rows = this.pages.get(channelId)?.localizations ?? [];
    return ok(rows.map((row) => ({ ...row })).sort((a, b) => a.locale.localeCompare(b.locale)));
  }

  async replace(
    channelId: string,
    settings: ChannelPageSettings,
    localizations: readonly ChannelLocalization[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    const referenced = [
      settings.trailerVideoId,
      settings.returningVideoId,
      ...localizations.map((row) => row.trailerVideoId),
    ];
    for (const videoId of referenced) {
      if (videoId === null) continue;
      const found = await this.videos.findById(videoId);
      if (isErr(found)) return found;
      if (!found.value) {
        return err(databaseUnavailable.during('replaceChannelPage')(`video ${videoId} is gone`));
      }
    }
    this.pages.set(channelId, {
      settings: { ...settings },
      localizations: localizations.map((row) => ({ ...row })),
    });
    return ok();
  }

  clear(): void {
    this.pages.clear();
  }
}
