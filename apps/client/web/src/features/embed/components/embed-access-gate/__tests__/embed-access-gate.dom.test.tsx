import { screen } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { getRouter } from '#app/router';

const SHARE_TOKEN = 'abcdefghijklmnopqrstuv';

const renderEmbed = (search: string, refusal: Parameters<typeof problemReply>[0]) =>
  renderRoute(getRouter, `/embed/${VIDEO_ID}${search}`, {
    handlers: [mockEndpoint(getVideo, () => problemReply(refusal))],
  });

describe('apps/client/web: EmbedAccessGate', () => {
  it.each([
    { search: '', href: `/watch/${VIDEO_ID}` },
    { search: `?s=${SHARE_TOKEN}`, href: `/watch/${VIDEO_ID}?s=${SHARE_TOKEN}` },
  ])(
    'sends a password-protected video to the watch page in a new tab, from $search',
    async ({ search, href }) => {
      await renderEmbed(search, ErrorCodes.VIDEO_PASSWORD_REQUIRED);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'This video is protected' })
      ).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'Open on Taitube to enter the password' });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    }
  );

  it('says a share link no longer works, with nothing to leave the frame for', async () => {
    await renderEmbed(`?s=${SHARE_TOKEN}`, ErrorCodes.SHARE_LINK_EXPIRED);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This link no longer works' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
