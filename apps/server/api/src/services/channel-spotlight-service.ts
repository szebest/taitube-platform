import type { ChannelSpotlight, ChannelSpotlightSettings } from '@vp/api-contracts';
import type {
  ChannelAuditRepositoryPort,
  ChannelPageRepositoryPort,
  ChannelRepositoryPort,
  SubscriptionRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type Channel,
  type ChannelLocalization,
  type ChannelPageSettings,
  pickLocalization,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type ChannelNotFound,
  type InvalidSpotlightVideo,
  channelNotFound,
  decideChannelTask,
  decideSpotlightVideo,
  isSpotlightable,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, andThenAsync, err, isErr, map, ok } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import type { ChannelIdentityService } from './channel-identity-service';
import type { VideoService, VideoSummaryView } from './video-service';

export interface ChannelSpotlightServiceDeps {
  channels: ChannelRepositoryPort;
  pages: ChannelPageRepositoryPort;
  videos: VideoRepository;
  subscriptions: Pick<SubscriptionRepositoryPort, 'isSubscribed'>;
  audit: ChannelAuditRepositoryPort;
  identity: Pick<ChannelIdentityService, 'findPublic' | 'recordChange'>;
  videoService: Pick<VideoService, 'summarize'>;
  /** The locales the app is translated into: a localization exists for one of these only. */
  locales: readonly string[];
}

export type GetSpotlightFailure = ChannelNotFound | DatabaseUnavailable;
export type SpotlightSettingsFailure = GetSpotlightFailure | AuthorizationFailure;
export type SetSpotlightFailure =
  | SpotlightSettingsFailure
  | InvalidSpotlightVideo
  | InvalidField<Record<never, never>>;

type SpotlightView = Omit<ChannelSpotlight, 'video'> & { video: VideoSummaryView | null };

/**
 * The block above a channel page's content. It is judged on every read, so a trailer that turned
 * private drops out without the creator saving anything.
 */
export class ChannelSpotlightService {
  constructor(private readonly deps: ChannelSpotlightServiceDeps) {}

  async get(
    viewer: UserContext | null,
    idOrHandle: string,
    locales: readonly string[]
  ): Promise<Result<SpotlightView, GetSpotlightFailure>> {
    const match = await this.deps.identity.findPublic(idOrHandle);
    return andThenAsync(match, async ({ channel }) => {
      const settings = await this.deps.pages.getSettings(channel.id);
      const localizations = await this.deps.pages.listLocalizations(channel.id);
      if (isErr(settings)) return settings;
      if (isErr(localizations)) return localizations;

      const trailer =
        pickLocalization(localizations.value, locales)?.trailerVideoId ??
        settings.value.trailerVideoId;
      const subscribed = await this.isSubscriber(viewer, channel);
      if (isErr(subscribed)) return subscribed;

      const candidates = [
        ...(subscribed.value
          ? [{ source: 'returning' as const, id: settings.value.returningVideoId }]
          : []),
        { source: 'trailer' as const, id: trailer },
      ];
      return await this.firstShowing(channel, candidates);
    });
  }

  async getSettings(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<ChannelSpotlightSettings, SpotlightSettingsFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-channel' });
    if (isErr(allowed)) return allowed;
    return await this.settingsOf(acting.channelId);
  }

  async replace(
    user: UserContext,
    acting: ActingChannel,
    input: ChannelSpotlightSettings
  ): Promise<Result<ChannelSpotlightSettings, SetSpotlightFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-channel' });
    if (isErr(allowed)) return allowed;

    const channel = await this.deps.channels.findById(acting.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(channelNotFound(acting.channelId));

    const localizations = this.checkLocales(input.localizations);
    if (isErr(localizations)) return localizations;
    const checked = await this.checkVideos(channel.value, input);
    if (isErr(checked)) return checked;

    const settings: ChannelPageSettings = {
      trailerVideoId: input.trailerVideoId,
      returningVideoId: input.returningVideoId,
    };
    const stored = await this.deps.pages.replace(channel.value.id, settings, localizations.value);
    if (isErr(stored)) return stored;

    const recorded = await this.deps.identity.recordChange(user, channel.value.id, ['spotlight']);
    if (isErr(recorded)) return recorded;
    return await this.settingsOf(channel.value.id);
  }

  private checkLocales(
    rows: ChannelSpotlightSettings['localizations']
  ): Result<ChannelLocalization[], InvalidField<Record<never, never>>> {
    const seen = new Set<string>();
    for (const { locale } of rows) {
      if (!this.deps.locales.includes(locale) || seen.has(locale)) {
        return err(
          invalidField(
            'localizations',
            `Each locale once, one of ${this.deps.locales.join(', ')}`,
            {}
          )
        );
      }
      seen.add(locale);
    }
    return ok(rows.map((row) => ({ ...row })));
  }

  private async checkVideos(
    channel: Channel,
    input: ChannelSpotlightSettings
  ): Promise<Result<void, InvalidSpotlightVideo | DatabaseUnavailable>> {
    const slots = [
      { field: 'trailerVideoId', id: input.trailerVideoId },
      { field: 'returningVideoId', id: input.returningVideoId },
      ...input.localizations.map(({ trailerVideoId }, index) => ({
        field: `localizations.${index}.trailerVideoId`,
        id: trailerVideoId,
      })),
    ];
    for (const { field, id } of slots) {
      if (id === null) continue;
      const video = await this.deps.videos.findById(id);
      if (isErr(video)) return video;
      const decided = decideSpotlightVideo(field, id, video.value, channel.userId);
      if (isErr(decided)) return decided;
    }
    return ok();
  }

  private async settingsOf(
    channelId: string
  ): Promise<Result<ChannelSpotlightSettings, DatabaseUnavailable>> {
    const settings = await this.deps.pages.getSettings(channelId);
    const localizations = await this.deps.pages.listLocalizations(channelId);
    if (isErr(settings)) return settings;
    if (isErr(localizations)) return localizations;
    return ok({ ...settings.value, localizations: localizations.value });
  }

  private async isSubscriber(
    viewer: UserContext | null,
    channel: Channel
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return viewer ? await this.deps.subscriptions.isSubscribed(viewer.id, channel.id) : ok(false);
  }

  private async firstShowing(
    channel: Channel,
    candidates: readonly { source: 'returning' | 'trailer'; id: string | null }[]
  ): Promise<Result<SpotlightView, DatabaseUnavailable>> {
    for (const { source, id } of candidates) {
      if (id === null) continue;
      const video = await this.deps.videos.findById(id);
      if (isErr(video)) return video;
      if (!isSpotlightable(video.value, channel.userId)) continue;

      const summaries = await this.deps.videoService.summarize([video.value]);
      return map(summaries, ([summary]) => ({ source, video: summary ?? null }));
    }
    return ok({ source: null, video: null });
  }
}
