import { renderToStaticMarkup } from 'react-dom/server';

import { AppProviders } from '#app/__tests__/providers';
import { WatchPending } from '../watch-pending';

describe('apps/client/web: watch pending', () => {
  it.each([
    'stage-skeleton',
    'engagement-bar-skeleton',
    'liner-notes-skeleton',
    'comment-thread-skeleton',
    'queue-skeleton',
  ])(
    'stands in for the page with the %s of the kit',
    (slot) => {
      const markup = renderToStaticMarkup(
        <AppProviders>
          <WatchPending />
        </AppProviders>
      );

      expect(markup).toContain(`data-slot="${slot}"`);
    }
  );
});
