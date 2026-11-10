import { expectErr, expectOk } from '@vp/testing/result';
import { OWNER, aPlaylist, aVideo } from '../../__tests__/entities';
import { decideSeriesMembership } from '../series-membership.rule';

describe('@vp/domain-rules: decideSeriesMembership', () => {
  it.each([
    { kind: 'series', ownerId: OWNER.id, allowed: true },
    { kind: 'series', ownerId: 'someone-else', allowed: false },
    { kind: 'playlist', ownerId: OWNER.id, allowed: true },
    { kind: 'playlist', ownerId: 'someone-else', allowed: true },
  ] as const)(
    'answers $allowed for a $kind with a video of $ownerId',
    ({ kind, ownerId, allowed }) => {
      const result = decideSeriesMembership(aPlaylist({ kind }), aVideo({ ownerId }));

      if (allowed) expect(expectOk(result)).toBe('video-1');
      else
        expect(expectErr(result)).toMatchObject({
          code: 'SERIES_VIDEO_NOT_OWNED',
          field: 'videoId',
          playlistId: 'playlist-1',
          videoId: 'video-1',
        });
    }
  );
});
