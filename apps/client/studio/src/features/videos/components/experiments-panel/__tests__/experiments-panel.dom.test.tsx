import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VIDEO_ID, video } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import {
  experiment,
  serveExperiments,
} from '#app/features/videos/__tests__/experiments-api.fixture';
import { getRouter } from '#app/router';

const OLDER = '0190c3a0-5e1d-7000-8000-00000000f199';

async function renderTests(options: Parameters<typeof serveExperiments>[1] = {}) {
  const user = userEvent.setup();
  const served = serveExperiments(video({ title: 'Launch day', version: 6 }), options);
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=tests`, {
    handlers: [signInBrowser()],
  });
  const list = await screen.findByRole('list', { name: 'Tests of this video' });
  return { ...served, list, user };
}

describe('apps/client/studio: ExperimentsPanel', () => {
  it('lists the tests in the order the API gives, newest first, each as a result card', async () => {
    const { list } = await renderTests({
      experiments: [
        experiment(),
        experiment({ id: OLDER, status: 'stopped', endedAt: '2026-02-01T12:00:00.000Z' }),
      ],
    });

    const [newest, older] = within(list).getAllByRole('article');

    expect(newest).toHaveTextContent('Running');
    expect(older).toHaveTextContent('Stopped');
    expect(within(older as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('says there is not enough data yet until each variant has 1000 impressions', async () => {
    await renderTests();

    expect(screen.getByText('Not enough data yet')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '420 of 1,000 impressions' })).toBeVisible();
  });

  it('applies a variant under the version of the video', async () => {
    const { state, user } = await renderTests();

    await user.click(screen.getByRole('button', { name: 'Apply B' }));

    expect(await screen.findByText('Variant applied')).toBeInTheDocument();
    expect(state.applied).toEqual([{ variantId: 'b', version: 6 }]);
    expect(await screen.findByText('Finished')).toBeInTheDocument();
    expect(screen.getAllByText('Winner').length).toBeGreaterThan(0);
  });

  it('asks what to do on a version conflict, and applies again on the newest version', async () => {
    const { state, user } = await renderTests({ conflicts: 1 });

    await user.click(screen.getByRole('button', { name: 'Apply B' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /overwrite/i }));

    expect(await screen.findByText('Variant applied')).toBeInTheDocument();
    expect(state.applied).toHaveLength(2);
  });

  it('stops a running test without a winner', async () => {
    const { state, user } = await renderTests();

    await user.click(screen.getByRole('button', { name: 'Stop the test' }));

    expect(await screen.findByText(/Test stopped/)).toBeInTheDocument();
    expect(state.stopped).toEqual([experiment().id]);
    expect(await screen.findByText('Stopped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply B' })).toBeNull();
    expect(screen.queryByText('Winner')).toBeNull();
  });

  it('says when the video has no tests', async () => {
    serveExperiments(video(), { experiments: [] });
    await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=tests`, {
      handlers: [signInBrowser()],
    });

    expect(await screen.findByText('No tests yet.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await renderTests();

    expect(await axeViolations()).toEqual([]);
  });
});
