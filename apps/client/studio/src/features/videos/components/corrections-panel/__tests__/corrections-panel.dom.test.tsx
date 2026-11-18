import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VIDEO_ID, video } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveVideoTools } from '#app/features/videos/__tests__/video-tools-api.fixture';
import { getRouter } from '#app/router';

async function renderCorrections() {
  const served = serveVideoTools(video({ title: 'Launch day', durationMs: 120_000 }));
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=corrections`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('heading', { name: 'Corrections' });
  return { ...served, user: userEvent.setup() };
}

const field = (name: string) => screen.getByRole('textbox', { name });

describe('apps/client/studio: CorrectionsPanel', () => {
  it('lists the cards of the video with their range', async () => {
    await renderCorrections();

    const list = await screen.findByRole('list', { name: 'Corrections of this video' });

    expect(list).toHaveTextContent('0:10 - 0:15');
    expect(list).toHaveTextContent('It costs 5 dollars');
  });

  it('adds a card from a range and a line of text', async () => {
    const { state, user } = await renderCorrections();

    await user.clear(field('Starts at'));
    await user.type(field('Starts at'), '0:30');
    await user.clear(field('Ends at'));
    await user.type(field('Ends at'), '0:36');
    await user.type(field('Correction'), 'The year is 2026');
    await user.click(screen.getByRole('button', { name: 'Add the correction' }));

    expect(await screen.findByText('Correction added')).toBeInTheDocument();
    expect(state.created).toEqual([{ startMs: 30_000, endMs: 36_000, text: 'The year is 2026' }]);
    expect(await screen.findByText('The year is 2026')).toBeInTheDocument();
  });

  it.each([
    { name: 'a range under two seconds', end: '0:01', text: 'Fix' },
    { name: 'a range of unreadable times', end: 'later', text: 'Fix' },
    { name: 'blank text', end: '0:06', text: '' },
  ])('refuses $name before sending anything', async ({ end, text }) => {
    const { state, user } = await renderCorrections();

    await user.clear(field('Ends at'));
    await user.type(field('Ends at'), end);
    if (text) await user.type(field('Correction'), text);
    await user.click(screen.getByRole('button', { name: 'Add the correction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Use a range of 2 to 30 seconds');
    expect(state.created).toEqual([]);
  });

  it('removes a card', async () => {
    const { state, user } = await renderCorrections();

    await user.click(await screen.findByRole('button', { name: 'Remove the correction at 0:10' }));

    expect(await screen.findByText('Correction removed')).toBeInTheDocument();
    expect(state.removed).toHaveLength(1);
    expect(await screen.findByText('No corrections.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await renderCorrections();

    expect(await axeViolations()).toEqual([]);
  });
});
