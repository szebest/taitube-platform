import { axeViolations } from '@kit/web-testing/dom';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { CHAPTERS, serveVideoTools } from '#app/features/videos/__tests__/video-tools-api.fixture';
import { getRouter } from '#app/router';

async function renderHistory(options: Parameters<typeof serveVideoTools>[1] = {}) {
  const served = serveVideoTools(
    video({ title: 'Launch day', chapters: CHAPTERS, version: 5 }),
    options
  );
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=history`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('heading', { name: 'History' });
  return { ...served, user: userEvent.setup() };
}

describe('apps/client/studio: HistoryPanel', () => {
  it('lists the versions, marks the current one and says what each changed', async () => {
    await renderHistory();

    const list = await screen.findByRole('list', { name: 'Versions of this video' });
    const [current, original] = within(list).getAllByRole('listitem');

    expect(current).toHaveTextContent('Version 5');
    expect(current).toHaveTextContent('Current');
    expect(current).toHaveTextContent('title and chapters');
    expect(original).toHaveTextContent('Before the first edit');
    expect(within(current as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('restores an older version under the current version of the video', async () => {
    const { state, user } = await renderHistory();

    await user.click(await screen.findByRole('button', { name: 'Restore version 4' }));

    expect(await screen.findByText('Version restored')).toBeInTheDocument();
    expect(state.restores).toEqual([{ id: '0190c3a0-5e1d-7000-8000-00000000e001', version: 5 }]);
  });

  it('asks what to do on a version conflict, and restores again on the newest version', async () => {
    const { state, user } = await renderHistory({ conflicts: 1 });

    await user.click(await screen.findByRole('button', { name: 'Restore version 4' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /overwrite/i }));

    expect(await screen.findByText('Version restored')).toBeInTheDocument();
    expect(state.restores).toHaveLength(2);
  });

  it('has no accessibility violations', async () => {
    await renderHistory();

    expect(await axeViolations()).toEqual([]);
  });
});
