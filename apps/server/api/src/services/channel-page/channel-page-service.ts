import { type Result, andThenAsync, err, isErr, map, ok } from '@kit/result';
import type { ChannelPageView } from '@vp/api-contracts';
import type {
  ChannelLayoutRepositoryPort,
  ChannelRepositoryPort,
  SubscriptionRepositoryPort,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type ChannelLayout,
  type ViewerAudience,
  defaultChannelLayout,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type ChannelNotFound,
  channelNotFound,
  decideChannelTask,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { followsChannel } from '../account-subscription';
import { readStoredLayout } from '../channel-layout-document';
import { findChannelByIdOrHandle } from '../channel-lookup';
import type { ChannelPageResolver } from './channel-page-resolver';

export interface ChannelPageServiceDeps {
  channels: ChannelRepositoryPort;
  layouts: Pick<ChannelLayoutRepositoryPort, 'getDraft' | 'getPublished'>;
  subscriptions: Pick<SubscriptionRepositoryPort, 'getUserSubscriptionChannelIds'>;
  resolver: Pick<ChannelPageResolver, 'resolve'>;
}

export interface PageQuery {
  tab?: string;
  seed?: string;
  locales: readonly string[];
}

export type GetPageFailure = ChannelNotFound | DatabaseUnavailable;
export type PreviewPageFailure = GetPageFailure | AuthorizationFailure;

/** The channel page a viewer, or a team member previewing the draft, is shown. */
export class ChannelPageService {
  constructor(private readonly deps: ChannelPageServiceDeps) {}

  async get(
    viewer: UserContext | null,
    idOrHandle: string,
    query: PageQuery
  ): Promise<Result<ChannelPageView, GetPageFailure>> {
    const channel = await findChannelByIdOrHandle(this.deps.channels, idOrHandle);
    return andThenAsync(channel, async (found) => {
      const published = await this.deps.layouts.getPublished(found.id);
      if (isErr(published)) return published;
      const audience = await this.audienceOf(viewer, found.id);
      if (isErr(audience)) return audience;
      const layout = readStoredLayout(published.value?.document) ?? defaultChannelLayout();
      return this.deps.resolver.resolve({
        channel: found,
        layout,
        revision: published.value?.version ?? null,
        cached: true,
        audience: audience.value,
        locales: query.locales,
        viewerId: viewer?.id ?? null,
        tab: query.tab,
        seed: query.seed,
        idOrHandle,
      });
    });
  }

  async preview(
    user: UserContext,
    acting: ActingChannel,
    as: 'visitor' | 'subscriber',
    query: PageQuery
  ): Promise<Result<ChannelPageView, PreviewPageFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-page' });
    if (isErr(allowed)) return allowed;
    const channel = await this.deps.channels.findById(acting.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(channelNotFound(acting.channelId));
    const draft = await this.deps.layouts.getDraft(acting.channelId);
    if (isErr(draft)) return draft;
    const published = await this.deps.layouts.getPublished(acting.channelId);
    if (isErr(published)) return published;

    const layout: ChannelLayout =
      readStoredLayout(draft.value?.document) ??
      readStoredLayout(published.value?.document) ??
      defaultChannelLayout();
    return this.deps.resolver.resolve({
      channel: channel.value,
      layout,
      revision: null,
      cached: false,
      audience: as === 'subscriber' ? 'subscriber' : 'guest',
      locales: query.locales,
      viewerId: null,
      tab: query.tab,
      seed: query.seed,
      idOrHandle: acting.channelId,
    });
  }

  private async audienceOf(
    viewer: UserContext | null,
    channelId: string
  ): Promise<Result<ViewerAudience, DatabaseUnavailable>> {
    if (!viewer) return ok('guest');
    const subscribed = await followsChannel(this.deps.subscriptions, viewer.id, channelId);
    return map(subscribed, (follows) => (follows ? 'subscriber' : 'member'));
  }
}
