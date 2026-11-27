import { attachedHls, parseMaster } from '#app/integrations/video-js/__tests__/offline-hls';
import { renderInPlayer } from '#app/integrations/video-js/__tests__/render-in-player';
import { StartAtDefaultQuality } from '../start-at-default-quality';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

describe('apps/client/web: StartAtDefaultQuality', () => {
  it.each([
    { quality: '480p', level: 0 },
    { quality: '720p', level: 1 },
    { quality: '1080p', level: 1 },
    { quality: 'auto', level: undefined },
  ])('starts at the $quality default on a master of 480p and 720p', async ({ quality, level }) => {
    const { video } = renderInPlayer(() => <StartAtDefaultQuality quality={quality} />);
    const hls = await attachedHls(video);
    const nextLevel = vi.spyOn(hls, 'nextLevel', 'set');

    await parseMaster(video, [480, 720], 720);

    await vi.waitFor(() =>
      level === undefined
        ? expect(nextLevel).not.toHaveBeenCalled()
        : expect(nextLevel).toHaveBeenLastCalledWith(level)
    );
  });
});
