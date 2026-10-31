import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';

import { LibraryEmpty } from '../library-empty';

describe('apps/client/web: LibraryEmpty', () => {
  it.each([
    { tab: 'history', line: 'Nothing watched yet' },
    { tab: 'searches', line: 'No searches yet' },
    { tab: 'liked', line: 'No liked videos yet' },
    { tab: 'comments', line: 'No comments yet' },
  ] as const)('says $line for the $tab tab', async ({ tab, line }) => {
    const markup = await renderPage(<LibraryEmpty tab={tab} />, AppProviders);

    expect(markup).toContain(line);
    expect(markup).toContain('role="status"');
  });
});
