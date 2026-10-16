import '@videojs/react/video/skin.css';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { VideoPlayer, VideoSkin, usePlayer } from '@videojs/react/video';
import { type SyntheticEvent, useEffect, useEffectEvent } from 'react';

import type { PlaybackQuality, TaitubePlayerProps } from '../taitube-player-props';

export function VideoJsEngine({
  playbackUrl,
  posterUrl,
  title,
  startTime,
  onTimeUpdate,
  onEnded,
  onQualityChange,
}: TaitubePlayerProps) {
  const handleLoadedMetadata = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    if (!startTime) {
      return;
    }

    currentTarget.currentTime = startTime;
  };

  return (
    <VideoPlayer title={title} poster={posterUrl}>
      <VideoSkin className="tw:aspect-video tw:w-full">
        <HlsJsVideo
          src={playbackUrl}
          crossOrigin="anonymous"
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={({ currentTarget: { currentTime, duration } }) =>
            onTimeUpdate?.({ currentTime, duration })
          }
          onEnded={({ currentTarget: { duration } }) => onEnded?.({ duration })}
        />
      </VideoSkin>
      <QualityReport onQualityChange={onQualityChange} />
    </VideoPlayer>
  );
}

function QualityReport({ onQualityChange }: Pick<TaitubePlayerProps, 'onQualityChange'>) {
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
