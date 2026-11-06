import { screen } from '@testing-library/react';
import { listCaptions } from '@vp/api-contracts';
import { writeCookie } from '@vp/ui';
import { captionTrack, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (props) => (
    <div
      role="group"
      aria-label="Media player"
      data-testid="player"
      data-defaults={JSON.stringify(props.defaults)}
      data-caption-tracks={JSON.stringify(props.captionTracks ?? [])}
      data-handlers={[props.onTimeUpdate, props.onPause, props.onEnded]
        .map((handler) => typeof handler)
        .join()}
    />
  ),
}));

const readPlayer = (attribute: string): unknown =>
  JSON.parse(screen.getByTestId('player').getAttribute(attribute) ?? '');

describe('apps/client/web: WatchPlayer', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('starts the player with the playback defaults the viewer saved and wires the progress saves', async () => {
    writeCookie(
      'vp.device',
      JSON.stringify({
        schema: 1,
        playback: { captionsOn: true, captionsSize: 'xlarge', captionsBackground: 'solid' },
        locale: null,
      }),
      { maxAge: 60 }
    );

    await renderWatch();

    expect(readPlayer('data-defaults')).toEqual({
      speed: 1,
      quality: 'auto',
      captionsOn: true,
      captionsLanguage: null,
      captionsSize: 'xlarge',
      captionsBackground: 'solid',
      statsOverlay: false,
    });
    expect(screen.getByTestId('player').getAttribute('data-handlers')).toBe(
      'function,function,function'
    );
  });

  it('hands the player the caption tracks of the video', async () => {
    const tracks = [captionTrack()];

    await renderWatch({
      handlers: [mockEndpoint(listCaptions, () => HttpResponse.json({ tracks }))],
    });

    await vi.waitFor(() => expect(readPlayer('data-caption-tracks')).toEqual(tracks));
  });
});
