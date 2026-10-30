import { screen, within } from '@testing-library/react';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';
import { stubSeek } from '#app/features/watch/__tests__/stub-player';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const WITH_CHAPTERS = [
  '00:00 Arrival',
  '01:00 The tram',
  '02:15 Rain',
  'The tram again at 01:30, see https://example.com/gear.',
].join('\n');

describe('apps/client/web: watch liner notes', () => {
  it('shows the views and the date above the description', async () => {
    await renderWatch({ video: { description: 'Shot on Hi8.' } });

    const notes = screen.getByRole('region', { name: 'Description' });
    expect(within(notes).getByText(/1\.2M views/)).toBeInTheDocument();
    expect(within(notes).getByText('Shot on Hi8.')).toBeInTheDocument();
  });

  it('lists the chapters, marks the one the playhead is in, and seeks to the one clicked', async () => {
    const { user } = await renderWatch({ video: { description: WITH_CHAPTERS } });
    const strip = screen.getByRole('navigation', { name: 'Chapters' });

    expect(within(strip).getAllByRole('button')).toHaveLength(3);
    expect(within(strip).getByRole('button', { name: /The tram/ })).toHaveAttribute(
      'aria-current',
      'true'
    );

    await user.click(within(strip).getByRole('button', { name: /Rain/ }));

    expect(stubSeek).toHaveBeenLastCalledWith(135);
  });

  it('seeks to a timecode in the text and opens a link in the text on its own', async () => {
    const { user } = await renderWatch({ video: { description: WITH_CHAPTERS } });
    const body = screen.getByRole('region', { name: 'Description' });

    await user.click(within(body).getByRole('button', { name: 'Seek to 01:30' }));

    expect(stubSeek).toHaveBeenLastCalledWith(90);
    expect(within(body).getByRole('link', { name: 'https://example.com/gear' })).toHaveAttribute(
      'rel',
      'noopener noreferrer nofollow'
    );
  });

  it.each([
    { scenario: 'one timecode', description: '00:00 Intro' },
    { scenario: 'timecodes that do not open at zero', description: '00:30 A\n01:00 B' },
    { scenario: 'no description', description: '' },
  ])('shows no chapter strip for ', async ({ description }) => {
    await renderWatch({ video: { description } });

    expect(screen.queryByRole('navigation', { name: 'Chapters' })).not.toBeInTheDocument();
  });
});
