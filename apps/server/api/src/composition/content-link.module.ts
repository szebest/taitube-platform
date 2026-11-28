import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { ContentLinkCache } from '../services/content-link-cache';
import { ContentLinkNotifier } from '../services/content-link-notifier';
import { ContentLinkReads } from '../services/content-link-reads';
import { ContentLinkService } from '../services/content-link-service';
import { Services } from './service-tokens';

export function registerContentLinkServices(c: Container): Container {
  return c
    .provide(Services.ContentLinkCache, (c) => new ContentLinkCache(c.get(Adapters.Cache)))
    .provide(
      Services.ContentLinkService,
      (c) =>
        new ContentLinkService({
          links: c.get(Adapters.Repositories).contentLinks,
          refs: c.get(Adapters.Repositories).contentRefs,
          channels: c.get(Adapters.Repositories).channels,
          restrictions: c.get(Adapters.Repositories).channelUserRestrictions,
          stats: c.get(Adapters.Repositories).contentLinkStats,
          cache: c.get(Services.ContentLinkCache),
          notifier: new ContentLinkNotifier({
            channels: c.get(Adapters.Repositories).channels,
            members: c.get(Adapters.Repositories).channelMembers,
            notifications: c.get(Adapters.Repositories).notifications,
            audit: c.get(Adapters.Repositories).channelAudit,
          }),
          now: Date.now,
        })
    )
    .provide(
      Services.ContentLinkReads,
      (c) =>
        new ContentLinkReads({
          links: c.get(Adapters.Repositories).contentLinks,
          refs: c.get(Adapters.Repositories).contentRefs,
          clips: c.get(Adapters.Repositories).clips,
          watchHistory: c.get(Adapters.Repositories).watchHistory,
          cache: c.get(Services.ContentLinkCache),
        })
    );
}
