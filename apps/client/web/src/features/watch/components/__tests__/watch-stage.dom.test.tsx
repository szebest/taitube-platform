import { screen } from '@testing-library/react';

import { renderWatch } from '../../__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('../../__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: watch stage in the browser', () => {
  it.each([
    { scenario: 'a start time', search: '?t=90', startTime: '90' },
    { scenario: 'no start time', search: '', startTime: null },
    { scenario: 'a start time that is not a number', search: '?t=soon', startTime: null },
  ])('hands the player ', async ({ search, startTime }) => {
    await renderWatch({ search });

    const player = screen.getByTestId('player');

    expect(player.getAttribute('data-start-time')).toBe(startTime);
  });
});
