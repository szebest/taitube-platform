import { screen } from '@testing-library/react';

import {
  channelHit,
  page,
  renderSearch,
  searchReply,
} from '#app/features/search/__tests__/search-fixtures';

const URL = '/search?q=react&type=channel';

describe('apps/client/web: ChannelResultHeader', () => {
  it('marks the search terms in the bio', async () => {
    await renderSearch(URL, [searchReply(() => page([channelHit()]))]);

    await screen.findByRole('heading', { name: 'React Conf' });

    expect(screen.getByText('React', { selector: 'mark' })).toBeInTheDocument();
  });

  it('leaves the bio out when the channel has none', async () => {
    await renderSearch(URL, [searchReply(() => page([channelHit({ bio: '' })]))]);

    await screen.findByRole('heading', { name: 'React Conf' });

    expect(screen.queryByText(/Talks about/)).not.toBeInTheDocument();
  });
});
