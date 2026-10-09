import type { Video } from '@vp/api-contracts';

import { VideoPlayer } from '#app/modules/shared/components';

import { useBundledHls } from '../hooks/use-bundled-hls';

export type WatchPlayerProps = Pick<Video, 'playbackUrl' | 'posterUrl'>;

const FRAME = { aspectRatio: '16 / 9', width: '100%', objectFit: 'cover' } as const;

export function WatchPlayer({ playbackUrl, posterUrl }: WatchPlayerProps) {
  const hlsReady = useBundledHls();

  if (hlsReady) return <VideoPlayer playbackUrl={playbackUrl} />;
  if (posterUrl) return <img src={posterUrl} alt="" style={FRAME} />;
  return <div style={FRAME} />;
}
