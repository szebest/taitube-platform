import { fireEvent, render, screen } from '@testing-library/react';
import type { CaptionTrackView } from '@vp/api-contracts';
import { IntlProvider } from '@vp/intl-react';
import { captionTrack } from '@vp/web-testing';
import { usePlayerState, VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import { PlayerHotkeys } from '../player-hotkeys';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

function CaptionsShown() {
  return (
    <output data-testid="shown">{String(usePlayerState((state) => state.captionsEnabled))}</output>
  );
}

function renderHotkeys(captionTracks: readonly CaptionTrackView[] = [captionTrack()]) {
  const rendered = render(
    <IntlProvider locale="en" timeZone="UTC">
      <input aria-label="Search" />
      <VideoJsEngine
        playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
        title="Launch day"
        captionTracks={captionTracks}
      >
        <button type="button">Inside</button>
        <input aria-label="Inside field" />
        <PlayerHotkeys />
        <CaptionsShown />
      </VideoJsEngine>
      <button type="button">Outside</button>
    </IntlProvider>
  );
  const shown = () => screen.getByTestId('shown').textContent;
  return { ...rendered, shown };
}

describe('apps/client/web: the player hotkeys', () => {
  it.each([
    { scenario: 'on the page itself', target: () => document.body, toggled: 'true' },
    {
      scenario: 'inside the player',
      target: () => screen.getByRole('button', { name: 'Inside' }),
      toggled: 'true',
    },
    {
      scenario: 'on a control outside the player',
      target: () => screen.getByRole('button', { name: 'Outside' }),
      toggled: 'false',
    },
    {
      scenario: 'in a field outside the player',
      target: () => screen.getByRole('textbox', { name: 'Search' }),
      toggled: 'false',
    },
    {
      scenario: 'in a field inside the player',
      target: () => screen.getByRole('textbox', { name: 'Inside field' }),
      toggled: 'false',
    },
  ])('toggles captions with c pressed $scenario: $toggled', ({ target, toggled }) => {
    const { shown } = renderHotkeys();

    fireEvent.keyDown(target(), { key: 'c' });

    expect(shown()).toBe(toggled);
  });

  it.each([
    { scenario: 'a capital C', key: 'C', modifiers: {}, toggled: 'true' },
    {
      scenario: 'c with Ctrl, left to the browser',
      key: 'c',
      modifiers: { ctrlKey: true },
      toggled: 'false',
    },
    {
      scenario: 'c with Cmd, left to the browser',
      key: 'c',
      modifiers: { metaKey: true },
      toggled: 'false',
    },
    { scenario: 'another key', key: 'x', modifiers: {}, toggled: 'false' },
  ])('answers $scenario: $toggled', ({ key, modifiers, toggled }) => {
    const { shown } = renderHotkeys();

    fireEvent.keyDown(document.body, { key, ...modifiers });

    expect(shown()).toBe(toggled);
  });

  it('turns captions off again with a second c', () => {
    const { shown } = renderHotkeys();

    fireEvent.keyDown(document.body, { key: 'c' });
    fireEvent.keyDown(document.body, { key: 'c' });

    expect(shown()).toBe('false');
  });

  it('does nothing with c on a video without captions', () => {
    const { shown } = renderHotkeys([]);

    fireEvent.keyDown(document.body, { key: 'c' });

    expect(shown()).toBe('false');
  });
});
