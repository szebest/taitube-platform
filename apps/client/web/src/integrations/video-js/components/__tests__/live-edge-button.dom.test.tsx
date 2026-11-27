import { screen } from '@testing-library/react';
import { renderInPlayer } from '#app/integrations/video-js/__tests__/render-in-player';
import { LiveEdgeButton } from '../live-edge-button';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

describe('apps/client/web: LiveEdgeButton', () => {
  it('names itself and draws its children from whether the stream is at the live edge', () => {
    renderInPlayer(() => (
      <LiveEdgeButton label={(atEdge) => (atEdge ? 'Live' : 'Go live')}>
        {(atEdge) => <span>{atEdge ? 'at edge' : 'behind'}</span>}
      </LiveEdgeButton>
    ));

    const button = screen.getByRole('button');

    expect([button.textContent, button.getAttribute('aria-label')]).toEqual([
      expect.stringMatching(/^(at edge|behind)$/),
      expect.stringMatching(/^(Live|Go live)$/),
    ]);
  });
});
