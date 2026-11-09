import { posix } from 'node:path';

const STORYLESS =
  'channel/channel-row channel/subscribe-action feed/feed-sentinel feed/paged-footer video/feed-video-card video/feedback-menu-items video/video-grid watch/share-dialog'.split(
    ' '
  );

/** Findings the tree still holds: each folder gets its index, story and spec, or leaves the kit. */
export const PENDING = [
  'apps/client/studio/src/components/states/route-fallbacks/: no index.ts',
  'apps/client/studio/src/components/states/route-fallbacks/: no __stories__/route-fallbacks.stories.tsx',
  'apps/client/studio/src/components/states/route-fallbacks/: no __tests__/route-fallbacks.dom.test.tsx',
  ...STORYLESS.map(
    (name) =>
      `apps/client/web/src/components/${name}/: no __stories__/${posix.basename(name)}.stories.tsx`
  ),
  'apps/client/web/src/components/player/control-bar/: no index.ts',
  'apps/client/web/src/components/player/taitube-preview/: no index.ts',
  'apps/client/web/src/components/states/route-fallbacks/: no index.ts',
  'apps/client/web/src/components/states/route-fallbacks/: no __stories__/route-fallbacks.stories.tsx',
  'apps/client/web/src/components/states/route-fallbacks/: no __tests__/route-fallbacks.dom.test.tsx',
];
