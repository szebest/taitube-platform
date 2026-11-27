import { useEffect, useEffectEvent } from 'react';
import type { PlaybackQuality, TaitubePlayerProps } from '#app/lib/player/taitube-player-props';
import { usePlayer } from '../player';

export function QualityReport({ onQualityChange }: Pick<TaitubePlayerProps, 'onQualityChange'>) {
  const rendition = usePlayer((state) => state.activeVideoRendition);
  const auto = usePlayer((state) => !state.videoRenditionList.some(({ selected }) => selected));

  const report = useEffectEvent((quality: PlaybackQuality) => onQualityChange?.(quality));

  useEffect(() => {
    if (!rendition) {
      return;
    }

    const { width, height, bitrate } = rendition;
    report({ width, height, bitrate, auto });
  }, [rendition, auto]);

  return null;
}
