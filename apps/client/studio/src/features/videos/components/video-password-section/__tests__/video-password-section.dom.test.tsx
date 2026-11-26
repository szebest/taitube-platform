import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Video } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, video } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveSharing } from '#app/features/videos/__tests__/sharing-api.fixture';
import { getRouter } from '#app/router';

const SECRET = 'open sesame';

async function renderPassword(
  patch: Partial<Video> = {},
  options: Parameters<typeof serveSharing>[1] = {}
) {
  const user = userEvent.setup();
  const served = serveSharing(video({ visibility: 'unlisted', ...patch }), options);
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=sharing`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('heading', { name: 'Password' });
  return { ...served, user };
}

const toggle = () => screen.getByRole('switch', { name: 'Protect with a password' });
const field = () => screen.getByLabelText('Password', { selector: 'input' });

async function typePassword(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.click(toggle());
  await user.type(field(), password);
  await user.click(screen.getByRole('button', { name: 'Save password' }));
}

describe('apps/client/studio: VideoPasswordSection', () => {
  it.each(['public', 'private'] as const)(
    'cannot be switched on for a %s video, and says why',
    async (visibility) => {
      await renderPassword({ visibility });

      expect(toggle()).toBeDisabled();
      expect(screen.getByText(/Only an unlisted video takes a password/)).toBeInTheDocument();
    }
  );

  it('says that a password and a share link are access gates, not encryption', async () => {
    await renderPassword();

    expect(screen.getByText('An access gate, not encryption')).toBeInTheDocument();
    expect(screen.getByText(/stays in the public storage under addresses/)).toBeInTheDocument();
  });

  it('sets a password and never shows it again', async () => {
    const { state, user } = await renderPassword();

    await typePassword(user, SECRET);

    expect(await screen.findByText('Password saved')).toBeInTheDocument();
    expect(state.passwords).toEqual([{ password: SECRET }]);
    expect(await screen.findByText('Viewers need the password to watch this video.')).toBeVisible();
    expect(field()).toHaveValue('');
    expect(field()).toHaveAttribute('type', 'password');
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it('refuses a password under four characters before sending it', async () => {
    const { state, user } = await renderPassword();

    await typePassword(user, 'abc');

    expect(screen.getByText('Use 4 to 128 characters.')).toBeInTheDocument();
    expect(state.passwords).toEqual([]);
  });

  it('presents a server that has passwords switched off', async () => {
    const { user } = await renderPassword({}, { refuseWith: ErrorCodes.VIDEO_PASSWORDS_OFF });

    await typePassword(user, SECRET);

    expect(await screen.findByText('The password was not saved.')).toBeInTheDocument();
    expect(screen.getByText('Passwords are switched off on this server.')).toBeInTheDocument();
  });

  it.each([
    { how: 'with Remove', act: () => screen.getByRole('button', { name: 'Remove password' }) },
    { how: 'by switching it off', act: toggle },
  ])('removes the password $how', async ({ act }) => {
    const { state, user } = await renderPassword({ passwordProtected: true });

    await user.click(act());

    expect(await screen.findByText('Password removed')).toBeInTheDocument();
    expect(state.cleared).toBe(1);
    expect(toggle()).not.toBeChecked();
  });

  it('still removes the password of a video that is no longer unlisted', async () => {
    const { user } = await renderPassword({ visibility: 'public', passwordProtected: true });

    expect(screen.getByRole('button', { name: 'Save password' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove password' }));

    expect(await screen.findByText('Password removed')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await renderPassword({ passwordProtected: true });

    expect(await axeViolations()).toEqual([]);
  });
});
