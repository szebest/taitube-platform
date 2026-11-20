import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Video } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, video } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import {
  experiment,
  serveExperiments,
} from '#app/features/videos/__tests__/experiments-api.fixture';
import { getRouter } from '#app/router';

async function renderForm(
  patch: Partial<Video> = {},
  options: Parameters<typeof serveExperiments>[1] = { experiments: [] }
) {
  const user = userEvent.setup();
  const served = serveExperiments(
    video({ title: 'Launch day', posterUrl: 'https://cdn.test/poster.jpg', ...patch }),
    options
  );
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=tests`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('heading', { name: 'Start a test' });
  return { ...served, user };
}

const title = (variant: string) =>
  screen.getByRole('textbox', { name: `Title, variant ${variant}` });
const start = () => screen.getByRole('button', { name: 'Start the test' });

describe('apps/client/studio: StartExperimentForm', () => {
  it.each([
    { thumbnails: 'one', posterUrl: 'https://cdn.test/poster.jpg', reason: 'it has one.' },
    { thumbnails: 'no', posterUrl: undefined, reason: 'it has 0.' },
  ])(
    'disables the thumbnail kinds of a video with $thumbnails thumbnail, and says why',
    async ({ posterUrl, reason }) => {
      await renderForm({ posterUrl });

      expect(screen.getByRole('radio', { name: 'Thumbnail' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Title and thumbnail' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Title' })).toBeChecked();
      expect(screen.getByText(new RegExp(reason.replace('.', '\\.')))).toBeInTheDocument();
    }
  );

  it('fills variant A with the current title as the control', async () => {
    await renderForm();

    const control = screen.getByRole('textbox', { name: 'Title, variant A (the control)' });

    expect(control).toHaveValue('Launch day');
    expect(control).toHaveAttribute('readonly');
  });

  it('starts a two-variant title test against the control', async () => {
    const { state, user } = await renderForm();

    await user.type(title('B'), 'We launched');
    await user.click(start());

    expect(await screen.findByText('Test started')).toBeInTheDocument();
    expect(state.started).toEqual([
      { kind: 'title', variants: [{ title: 'Launch day' }, { title: 'We launched' }] },
    ]);
    expect(title('B')).toHaveValue('');
  });

  it('starts a test of three variants', async () => {
    const { state, user } = await renderForm();

    await user.click(screen.getByRole('radio', { name: '3 variants' }));
    await user.type(title('B'), 'We launched');
    await user.type(title('C'), 'Launch day, the whole story');
    await user.click(start());

    await screen.findByText('Test started');
    expect(state.started).toMatchObject([
      { variants: [{}, {}, { title: 'Launch day, the whole story' }] },
    ]);
  });

  it.each([
    { name: 'an empty title', typed: null },
    { name: 'the control title again', typed: 'Launch day' },
  ])('refuses $name before sending anything', async ({ typed }) => {
    const { state, user } = await renderForm();

    if (typed) await user.type(title('B'), typed);
    await user.click(start());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Give each variant a different title of 1 to 255 characters.'
    );
    expect(state.started).toEqual([]);
  });

  it('waits while a test runs on the video, and says why', async () => {
    await renderForm({}, { experiments: [experiment()] });

    expect(await screen.findByText(/A test is running on this video/)).toBeInTheDocument();
    expect(start()).toBeDisabled();
  });

  it('presents the limit when the channel runs the most tests it can', async () => {
    const { user } = await renderForm(
      {},
      { experiments: [], refuseWith: ErrorCodes.EXPERIMENT_LIMIT }
    );

    await user.type(title('B'), 'We launched');
    await user.click(start());

    expect(await screen.findByText('The test did not start.')).toBeInTheDocument();
    expect(screen.getByText(/the channel runs the most tests it can/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await renderForm();

    expect(await axeViolations()).toEqual([]);
  });
});
