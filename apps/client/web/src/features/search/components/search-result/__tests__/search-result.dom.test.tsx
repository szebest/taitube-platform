import {
  channelHit,
  playlistResult,
  renderResultRows,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';
import { searchResultKey } from '../search-result';

describe('apps/client/web: SearchResult', () => {
  it.each([
    { type: 'video', hit: videoResult(), name: 'React in practice', role: 'link' },
    { type: 'channel', hit: channelHit(), name: 'React Conf', role: 'heading' },
    { type: 'playlist', hit: playlistResult(), name: 'React course', role: 'link' },
  ] as const)('renders a $type hit with its own row', async ({ type, hit, name, role }) => {
    const { rows } = await renderResultRows('react', [hit], type);

    expect(rows.getByRole(role, { name })).toBeInTheDocument();
  });

  it('keys a hit by its type and id, so the same id of two kinds stays apart', () => {
    const video = videoResult();
    const playlist = playlistResult({ id: video.data.id });

    expect(searchResultKey(video)).toBe(`video:${video.data.id}`);
    expect(searchResultKey(video)).not.toBe(searchResultKey(playlist));
  });
});
