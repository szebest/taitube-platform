import { screen } from '@testing-library/react';
import { OWNER_ID } from '@vp/web-testing';
import { uuid } from '#app/__tests__/library-fixtures';
import { adder, annotatedPlaylist } from '#app/features/library/__tests__/annotated-playlist';
import { renderPlaylist, rowOf } from '#app/features/library/__tests__/render-playlist';

const OWNER = uuid(9001);

/** The viewer is a contributor on someone else's playlist and added Tram ride; the owner added the rest. */
const renderAsContributor = () => {
  const playlist = annotatedPlaylist({ ownerId: OWNER });
  return renderPlaylist({
    ...playlist,
    viewer: { role: 'contributor', following: false },
    items: playlist.items.map((item, index) => ({
      ...item,
      addedBy: adder(index === 0 ? OWNER_ID : OWNER),
    })),
  });
};

const menuOf = async (title: string) => {
  const { user } = await renderAsContributor();
  await user.click((await rowOf(title)).getByRole('button', { name: 'More actions' }));
  await screen.findAllByRole('menuitem');
  return screen.queryAllByRole('menuitem').map(({ textContent }) => textContent);
};

describe('apps/client/web: a video of the playlist', () => {
  it.each([
    { title: 'Tram ride', whose: 'their own', shown: true },
    { title: 'Old film', whose: "someone else's", shown: false },
  ])('lets a contributor annotate and remove $whose item: $shown', async ({ title, shown }) => {
    const items = await menuOf(title);

    expect(items.includes('Edit note and segment')).toBe(shown);
    expect(items.includes('Remove from playlist')).toBe(shown);
    expect(items.includes('Move to top')).toBe(false);
  });

  it('names who added each item once the playlist has collaborators', async () => {
    await renderAsContributor();

    await rowOf('Tram ride');

    expect(screen.getAllByRole('img', { name: /^Added by / })).toHaveLength(3);
  });

  it('names nobody in a playlist only its owner fills', async () => {
    await renderPlaylist(annotatedPlaylist());

    await rowOf('Tram ride');

    expect(screen.queryByRole('img', { name: /^Added by / })).toBeNull();
  });
});
