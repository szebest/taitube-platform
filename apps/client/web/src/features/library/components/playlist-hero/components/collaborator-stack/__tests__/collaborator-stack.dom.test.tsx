import { screen, within } from '@testing-library/react';
import { collaborator, seated } from '#app/features/library/__tests__/playlist-people';
import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';

const PEOPLE = ['Ana', 'Bo', 'Cy', 'Di', 'Ed', 'Flo'].map((name, at) => collaborator(at + 1, name));

describe('apps/client/web: the collaborator stack', () => {
  it('shows the first four faces and counts the rest', async () => {
    await renderPlaylist({}, [seated(PEOPLE)]);

    const stack = await screen.findByRole('list', { name: 'Collaborators' });

    expect(within(stack).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('2 more collaborators')).toBeInTheDocument();
  });
});
