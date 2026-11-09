import { posix } from 'node:path';

const STORYLESS =
  'channel/channel-row channel/subscribe-action feed/feed-sentinel feed/paged-footer video/feed-video-card video/feedback-menu-items video/video-grid watch/share-dialog'.split(
    ' '
  );

/** Findings the tree still holds: each folder gets its index, story and spec, or leaves the kit. */
export const PENDING = [
  ...STORYLESS.map(
    (name) =>
      `apps/client/web/src/components/${name}/: no __stories__/${posix.basename(name)}.stories.tsx`
  ),
  'apps/client/web/src/components/player/control-bar/: no index.ts',
  'apps/client/web/src/components/player/taitube-preview/: no index.ts',
];
