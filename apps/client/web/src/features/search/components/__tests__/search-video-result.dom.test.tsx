import { CHANNEL_ID } from '@vp/web-testing';

import { renderResultRows, videoResult } from '#app/features/search/__tests__/search-fixtures';

async function row(overrides: Parameters<typeof videoResult>[0] = {}) {
  const { rows } = await renderResultRows('react', [videoResult(overrides)], 'video');
  return rows;
}

describe('apps/client/web: SearchVideoResult', () => {
  it('shows the matched title, views, duration and snippet', async () => {
    const result = await row();

    expect(result.getByRole('link', { name: 'React in practice' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/watch\//)
    );
    expect(result.getByText(/1\.5K views/)).toBeInTheDocument();
    expect(result.getByText('10:12')).toBeInTheDocument();
    expect(result.getByText(/the practical way/)).toBeInTheDocument();
    expect(result.getAllByText('React', { selector: 'mark' })).toHaveLength(2);
  });

  it('falls back to the untitled word when the video has no title', async () => {
    const result = await row({ title: null });

    expect(result.getByRole('link', { name: 'Untitled video' })).toBeInTheDocument();
  });

  it('leaves the snippet out when there is no description', async () => {
    const result = await row({ description: '' });

    expect(result.queryByText(/practical way/)).not.toBeInTheDocument();
  });

  it('links the byline to the channel', async () => {
    const result = await row({
      channel: { id: CHANNEL_ID, displayName: 'React Conf', handle: 'reactconf', avatarUrl: null },
    });

    expect(result.getByRole('link', { name: /React Conf/ })).toHaveAttribute(
      'href',
      `/channel/${CHANNEL_ID}`
    );
  });
});
