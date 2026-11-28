import { act } from '@testing-library/react';
import { Events } from 'hls.js';
import { parseMaster } from '#app/integrations/video-js/__tests__/offline-hls';
import { renderInPlayer } from '#app/integrations/video-js/__tests__/render-in-player';
import { usePlayerCommands } from '#app/integrations/video-js/hooks/use-player-commands';
import { QualityReport } from '../quality-report';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

function PickRendition() {
  const { selectVideoRendition } = usePlayerCommands();

  return (
    <button type="button" onClick={() => selectVideoRendition('0')}>
      Pick 360p
    </button>
  );
}

function renderReport(onQualityChange: () => void) {
  return renderInPlayer(() => (
    <>
      <PickRendition />
      <QualityReport onQualityChange={onQualityChange} />
    </>
  ));
}

describe('apps/client/web: QualityReport', () => {
  it.each([
    {
      picker: 'adaptive bitrate',
      picked: false,
      level: 1,
      quality: { width: 1280, height: 720, bitrate: 2_880_000, auto: true },
    },
    {
      picker: 'the viewer',
      picked: true,
      level: 0,
      quality: { width: 640, height: 360, bitrate: 1_440_000, auto: false },
    },
  ])(
    'reports the rendition $picker picked as the active quality',
    async ({ picked, level, quality }) => {
      const onQualityChange = vi.fn();
      const { video, getByRole } = renderReport(onQualityChange);
      const hls = await parseMaster(video, [360, 720], 720);

      if (picked) {
        getByRole('button', { name: 'Pick 360p' }).click();
      }
      act(() => {
        hls.trigger(Events.LEVEL_SWITCHED, { level });
      });

      await vi.waitFor(() => expect(onQualityChange).toHaveBeenLastCalledWith(quality));
    }
  );

  it('reports nothing before a rendition plays', () => {
    const onQualityChange = vi.fn();

    renderReport(onQualityChange);

    expect(onQualityChange).not.toHaveBeenCalled();
  });
});
