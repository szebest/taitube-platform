import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { PlaylistLinkExpired } from '../playlist-link-expired';

describe('apps/client/web: the expired share link page', () => {
  it('says the link no longer works and offers the home page', async () => {
    await renderPart(<PlaylistLinkExpired />);

    expect(screen.getByText('This share link no longer works')).toBeInTheDocument();
    expect(
      screen.getByText('It expired or was revoked. Ask whoever shared the playlist for a new one.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
    expect(await axeViolations()).toEqual([]);
  });
});
