import { video } from '@vp/web-testing';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import { getOpenedSession } from '../to-open-action';

const page = video({ title: 'Launch day' });
const other = { ...video({ title: 'Tram ride' }), id: '0190c3a0-5e1d-7000-8000-00000000a099' };
const open = { video: page, startTime: undefined, autoplay: false, shareToken: undefined };

describe('apps/client/web: getOpenedSession', () => {
  it.each([
    { scenario: 'no list', list: undefined, playlist: undefined, ids: [page.id] },
    {
      scenario: 'a list that has not loaded',
      list: 'a-list',
      playlist: undefined,
      ids: [],
    },
    {
      scenario: 'a loaded list',
      list: 'a-list',
      playlist: playlistDetail('a-list', [
        { ...page, channel: null },
        { ...other, channel: null },
      ]),
      ids: [page.id, other.id],
    },
  ])('queues $ids.length videos for $scenario', ({ list, playlist, ids }) => {
    const { videos, current } = getOpenedSession({ ...open, list }, playlist);

    expect(videos.map(({ id }) => id)).toEqual(ids);
    expect(current?.video.id).toBe(page.id);
  });
});
