import type { ChannelLocalization, ChannelPageSettings } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * What a channel page shows above its content: the trailer, the returning-subscriber video and the
 * per-language overrides. The store keeps what was saved, whatever state each video is in since:
 * which of them still show is the service's decision.
 */
export interface ChannelPageRepositoryPort {
  /** Nothing saved reads as both slots empty. */
  getSettings(channelId: string): Promise<Result<ChannelPageSettings, DatabaseUnavailable>>;
  listLocalizations(channelId: string): Promise<Result<ChannelLocalization[], DatabaseUnavailable>>;
  /**
   * Swaps the settings and the whole set of localizations in one write: a video that is gone
   * fails it and leaves what was saved as it was.
   */
  replace(
    channelId: string,
    settings: ChannelPageSettings,
    localizations: readonly ChannelLocalization[]
  ): Promise<Result<void, DatabaseUnavailable>>;
}
