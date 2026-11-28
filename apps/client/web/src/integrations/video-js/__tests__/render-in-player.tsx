import { render } from '@testing-library/react';
import { Container } from '@videojs/react';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { createRef, type ReactNode, type RefObject } from 'react';
import { PlayerChannelProvider } from '#app/lib/player/player-channel';
import type { TaitubePlayerProps } from '#app/lib/player/taitube-player-props';
import { CaptionsContext, useCaptions } from '../hooks/use-captions';
import { VideoPlayer } from '../player';

const PLAYBACK_URL = 'http://localhost:9000/public/videos/v1/hls/master.m3u8';

interface StageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  captionTracks: TaitubePlayerProps['captionTracks'];
  children: ReactNode;
}

function Stage({ videoRef, captionTracks, children }: StageProps) {
  const captions = useCaptions(videoRef, PLAYBACK_URL, captionTracks, undefined);

  return (
    <VideoPlayer>
      <CaptionsContext value={captions}>
        <Container>
          <HlsJsVideo ref={videoRef} src={PLAYBACK_URL} crossOrigin="anonymous" playsInline>
            {captions.state.captionTracks.map(({ id, language, src }) => (
              <track key={id} id={id} kind="captions" src={src} srcLang={language ?? undefined} />
            ))}
          </HlsJsVideo>
          {children}
        </Container>
      </CaptionsContext>
    </VideoPlayer>
  );
}

/** Mounts `ui` inside a player and a channel, over a video that plays nothing. */
export function renderInPlayer(
  ui: (videoRef: RefObject<HTMLVideoElement | null>) => ReactNode,
  captionTracks?: TaitubePlayerProps['captionTracks']
) {
  const videoRef = createRef<HTMLVideoElement>();
  const stage = (next: typeof ui, tracks: typeof captionTracks) => (
    <Stage videoRef={videoRef} captionTracks={tracks}>
      {next(videoRef)}
    </Stage>
  );
  const rendered = render(stage(ui, captionTracks), { wrapper: PlayerChannelProvider });
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');

  return {
    ...rendered,
    video,
    change: (next: typeof ui) => rendered.rerender(stage(next, captionTracks)),
  };
}
