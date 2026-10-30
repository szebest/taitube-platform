import { renderToStaticMarkup } from 'react-dom/server';

import { AppProviders } from '#app/__tests__/providers';
import { WatchPending } from '../watch-pending';

const renderPending = () =>
  renderToStaticMarkup(
    <AppProviders>
      <WatchPending />
    </AppProviders>
  );

describe('apps/client/web: watch pending', () => {
  it.each([
    'stage-skeleton',
    'engagement-bar-skeleton',
    'liner-notes-skeleton',
    'comment-thread-skeleton',
    'queue-skeleton',
  ])('stands in for the page with the %s of the kit', (slot) => {
    expect(renderPending()).toContain(`data-slot="${slot}"`);
  });

  it('holds the place of the compact Queue button, hidden from the medium breakpoint', () => {
    expect(renderPending()).toContain('tw:h-control-md tw:w-[7rem] tw:medium:hidden');
  });
});
