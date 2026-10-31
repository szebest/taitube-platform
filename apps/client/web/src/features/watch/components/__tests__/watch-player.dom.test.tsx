import { screen } from '@testing-library/react';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (props) => (
    <div
      data-testid="player"
      data-defaults={JSON.stringify(props.defaults)}
      data-handlers={[props.onTimeUpdate, props.onPause, props.onEnded]
        .map((handler) => typeof handler)
        .join()}
    />
  ),
}));

describe('apps/client/web: WatchPlayer', () => {
  it('starts the player at the speed and quality the viewer chose and wires the progress saves', async () => {
    await renderWatch();

    const player = screen.getByTestId('player');

    expect(JSON.parse(player.getAttribute('data-defaults') ?? '')).toEqual({
      speed: 1,
      quality: 'auto',
    });
    expect(player.getAttribute('data-handlers')).toBe('function,function,function');
  });
});
