import { renderLive } from '#app/features/live/__tests__/render-live';
import { LiveViewersPlot } from '../live-viewers-plot';

describe('apps/client/studio: LiveViewersPlot', () => {
  it('fills the plot area the frame reserves for it', () => {
    const { container } = renderLive(
      <LiveViewersPlot
        points={[
          { at: '2026-11-05T10:00:00.000Z', viewers: 3 },
          { at: '2026-11-05T10:00:15.000Z', viewers: 5 },
        ]}
        name="Viewers"
      />
    );

    expect(container.querySelector('.recharts-responsive-container')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });
});
