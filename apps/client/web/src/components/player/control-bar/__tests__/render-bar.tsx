import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { Fragment } from 'react';
import { VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import { PlayerChannelProvider, usePlayerTheater } from '#app/lib/player/player-channel';
import type { PlaybackRange } from '#app/lib/player/taitube-player-props';
import { ControlBar } from '../control-bar';

type Fullscreen = 'unsupported' | 'inline' | 'fullscreen';

interface Playhead {
  paused: boolean;
  currentTime: number;
  duration: number;
  fullscreen: Fullscreen;
}

function stubFullscreen(fullscreen: Fullscreen) {
  const requestFullscreen = vi.fn();
  const exitFullscreen = vi.fn();
  const stubs = [
    { on: document, name: 'fullscreenEnabled', get: () => fullscreen !== 'unsupported' },
    {
      on: document,
      name: 'fullscreenElement',
      get: () =>
        fullscreen === 'fullscreen' ? screen.getByRole('group', { name: 'Media player' }) : null,
    },
    { on: document, name: 'exitFullscreen', get: () => exitFullscreen },
    { on: HTMLElement.prototype, name: 'requestFullscreen', get: () => requestFullscreen },
  ];
  for (const { on, name, get } of stubs) {
    Object.defineProperty(on, name, { configurable: true, get });
    onTestFinished(() => {
      Reflect.deleteProperty(on, name);
    });
  }
  return { requestFullscreen, exitFullscreen };
}

function TheaterProbe() {
  return <output data-testid="theater">{String(usePlayerTheater())}</output>;
}

export function renderBar({
  paused = true,
  currentTime = 0,
  duration = 600,
  fullscreen = 'unsupported',
  channel = false,
  live = false,
  range,
  title,
}: Partial<Playhead> & {
  channel?: boolean;
  live?: boolean;
  range?: PlaybackRange;
  title?: string;
} = {}) {
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(paused);
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'get').mockReturnValue(currentTime);
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(duration);
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(
    HTMLMediaElement.HAVE_ENOUGH_DATA
  );
  const fullscreenCalls = stubFullscreen(fullscreen);
  const user = userEvent.setup();
  const Channel = channel ? PlayerChannelProvider : Fragment;
  const rendered = render(
    <IntlProvider locale="en" timeZone="UTC">
      <Channel>
        <VideoJsEngine
          playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
          posterUrl="http://localhost:9000/posters/p.jpg"
          title="Launch day"
        >
          <ControlBar title={title} live={live} range={range} />
        </VideoJsEngine>
        <TheaterProbe />
      </Channel>
    </IntlProvider>
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  const player = screen.getByRole('group', { name: 'Media player' });
  const bar = screen.getByRole('group', { name: 'Player controls' });
  return { ...rendered, user, video, player, bar, fullscreenCalls };
}
