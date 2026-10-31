import { render, screen } from '@testing-library/react';
import { IntlProvider } from '@vp/intl-react';

import { EmbedNotFound } from '../embed-not-found';

describe('apps/client/web: EmbedNotFound', () => {
  it('says the video is not available, and nothing else', () => {
    render(
      <IntlProvider locale="en" timeZone="UTC">
        <EmbedNotFound />
      </IntlProvider>
    );

    expect(screen.getByRole('status')).toHaveTextContent('This video is not available');
  });
});
