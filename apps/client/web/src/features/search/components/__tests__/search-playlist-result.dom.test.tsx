import { playlistResult, renderResultRows } from '#app/features/search/__tests__/search-fixtures';

const OWNER_ID = '0190c3a0-5e1d-7000-8000-00000000c009';
async function row(overrides: Parameters<typeof playlistResult>[0] = {}) {
  const { rows } = await renderResultRows('react', [playlistResult(overrides)], 'playlist');
  return rows;
}

describe('apps/client/web: SearchPlaylistResult', () => {
  it('links the matched title to the playlist and shows its video count', async () => {
    const result = await row();

    expect(result.getByRole('link', { name: 'React course' })).toHaveAttribute(
      'href',
      '/playlist?list=0190c3a0-5e1d-7000-8000-00000000d001'
    );
    expect(result.getAllByText('12 videos').length).toBeGreaterThan(0);
    expect(result.getByText('React', { selector: 'mark' })).toBeInTheDocument();
  });

  it('links the owner to their channel when the playlist has one', async () => {
    const result = await row({
      owner: { id: OWNER_ID, displayName: 'Ada', handle: 'ada', avatarUrl: null },
    });

    expect(result.getByRole('link', { name: /Ada/ })).toHaveAttribute(
      'href',
      `/channel/${OWNER_ID}`
    );
  });

  it('shows no owner link when it has none', async () => {
    const result = await row({ owner: null });

    expect(result.queryByRole('link', { name: /Ada/ })).not.toBeInTheDocument();
    expect(result.getAllByRole('link')).toHaveLength(1);
  });
});
