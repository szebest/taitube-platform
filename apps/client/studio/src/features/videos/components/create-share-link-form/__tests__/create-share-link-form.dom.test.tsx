import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_ACTIVE_SHARE_LINKS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, video } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveSharing, shareLink } from '#app/features/videos/__tests__/sharing-api.fixture';
import { getRouter } from '#app/router';

async function renderForm(options: Parameters<typeof serveSharing>[1] = {}) {
  const user = userEvent.setup();
  const served = serveSharing(video({ title: 'Launch day' }), options);
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=sharing`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('heading', { name: 'Share links' });
  return { ...served, user };
}

const create = () => screen.getByRole('button', { name: 'Create link' });

describe('apps/client/studio: CreateShareLinkForm', () => {
  it('creates a link with a label and the chosen expiry, and lists it', async () => {
    const { state, user } = await renderForm();

    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Client review');
    await user.click(screen.getByRole('combobox', { name: 'Expires after' }));
    await user.click(await screen.findByRole('option', { name: '24 hours' }));
    await user.click(create());

    expect(await screen.findByText('Share link created')).toBeInTheDocument();
    expect(state.created).toEqual([{ label: 'Client review', expiresIn: '24h' }]);
    const table = await screen.findByRole('table', { name: 'Share links of this video' });
    expect(await within(table).findByText('Client review')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('');
  });

  it('sends no label when none is written, and a week by default', async () => {
    const { state, user } = await renderForm();

    await user.click(create());

    expect(await screen.findByText('Share link created')).toBeInTheDocument();
    expect(state.created).toEqual([{ expiresIn: '7d' }]);
  });

  it('refuses a label over 60 characters before sending anything', async () => {
    const { state, user } = await renderForm();

    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'x'.repeat(61));
    await user.click(create());

    expect(screen.getByText('Use a label of up to 60 characters.')).toBeInTheDocument();
    expect(state.created).toEqual([]);
  });

  it('says the video holds the most links it can, before asking', async () => {
    const links = Array.from({ length: MAX_ACTIVE_SHARE_LINKS }, (_, index) =>
      shareLink({ id: `0190c3a0-5e1d-7000-8000-0000000${String(index).padStart(5, '0')}` })
    );
    const { state, user } = await renderForm({ links });

    await user.click(create());

    expect(screen.getByText(/the most active share links it can hold/)).toBeInTheDocument();
    expect(state.created).toEqual([]);
  });

  it('presents the limit when the API refuses the link', async () => {
    const { user } = await renderForm({ refuseWith: ErrorCodes.SHARE_LINK_LIMIT });

    await user.click(create());

    expect(await screen.findByText('The share link was not created.')).toBeInTheDocument();
    expect(screen.getByText(/the most active share links it can hold/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await renderForm();

    expect(await axeViolations()).toEqual([]);
  });
});
