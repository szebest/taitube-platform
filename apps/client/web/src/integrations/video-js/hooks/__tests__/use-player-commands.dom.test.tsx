import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { renderInPlayer } from '#app/integrations/video-js/__tests__/render-in-player';
import { usePlayerCommands } from '../use-player-commands';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

function Commands() {
  const { play, requestPictureInPicture, exitPictureInPicture } = usePlayerCommands();

  return (
    <>
      <button type="button" onClick={play}>
        play
      </button>
      <button type="button" onClick={requestPictureInPicture}>
        enter
      </button>
      <button type="button" onClick={exitPictureInPicture}>
        exit
      </button>
    </>
  );
}

describe('apps/client/web: usePlayerCommands', () => {
  it('plays the media', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    renderInPlayer(() => <Commands />);

    await userEvent.click(screen.getByRole('button', { name: 'play' }));

    expect(play).toHaveBeenCalledOnce();
  });

  it.each(['enter', 'exit'])(
    'lets a refused picture in picture %s pass without an error',
    async (name) => {
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      renderInPlayer(() => <Commands />);

      await userEvent.click(screen.getByRole('button', { name }));
      await vi.waitFor(() => expect(screen.getByRole('button', { name })).toBeEnabled());

      process.off('unhandledRejection', unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    }
  );
});
