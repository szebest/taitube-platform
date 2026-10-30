import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { creatorVideo, videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

const TITLES = ['Lisbon at night', 'Harbour at dawn', 'Night bus to Porto'];

async function renderTable() {
  serveLibrary([
    {
      cursor: null,
      items: TITLES.map((title, index) => creatorVideo({ id: videoIdOf(index), title })),
      next: null,
    },
  ]);
  const rendered = await renderRoute(getRouter, '/videos', { handlers: [signInBrowser()] });
  await screen.findByRole('table', { name: 'Your videos' });
  return rendered;
}

const bodyRows = () =>
  within(screen.getAllByRole('rowgroup')[1] as HTMLElement).getAllByRole('row');

describe('apps/client/studio: LibraryTable', () => {
  it('moves between rows with the arrow keys, one stop in the tab order', async () => {
    const { user } = await renderTable();
    const [first, second] = bodyRows();

    first?.focus();
    await user.keyboard('{ArrowDown}');

    expect(second).toHaveFocus();
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(second).toHaveAttribute('tabindex', '0');

    await user.keyboard('{ArrowUp}');

    expect(first).toHaveFocus();
  });

  it('selects a row with Space and announces how many are selected', async () => {
    const { user } = await renderTable();

    bodyRows()[1]?.focus();
    await user.keyboard(' ');

    expect(bodyRows()[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('1 selected');

    bodyRows()[0]?.focus();
    await user.keyboard('{Shift>} {/Shift}');

    expect(screen.getByRole('status')).toHaveTextContent('2 selected');
  });

  it('clears the selection when the page changes', async () => {
    serveLibrary([
      { cursor: null, items: [creatorVideo({ id: videoIdOf(0), title: 'First' })], next: 'c2' },
      { cursor: 'c2', items: [creatorVideo({ id: videoIdOf(1), title: 'Second' })], next: null },
    ]);
    const { user } = await renderRoute(getRouter, '/videos', { handlers: [signInBrowser()] });
    await screen.findByRole('table', { name: 'Your videos' });
    bodyRows()[0]?.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('status')).toHaveTextContent('1 selected');

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await screen.findByText('Second');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('offers each video the edit and analytics links through its menu', async () => {
    const { user } = await renderTable();

    await user.click(screen.getByRole('button', { name: 'Actions for Harbour at dawn' }));

    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/upload/edit/${videoIdOf(1)}`
    );
    expect(screen.getByRole('menuitem', { name: 'Analytics' })).toHaveAttribute(
      'href',
      `/videos/${videoIdOf(1)}/analytics`
    );
  });
});
