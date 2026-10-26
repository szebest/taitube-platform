import { adminUser, creatorUser, publicVideo, rejectedVideo } from '../../__mocks__/fixtures';
import { getUserPermissions } from '../../ability';
import { toVideoSubject } from '../../normalizers/index';
import type { UserContext, VideoResource } from '../../types/index';
import { pickPermittedFields } from '../fields';

const patch = { title: 'new title', visibility: 'public' } as const;

describe('pickPermittedFields', () => {
  it.each<{ scenario: string; user: UserContext; video: VideoResource; expected: object }>([
    {
      scenario: 'the owner of a taken-down video',
      user: creatorUser,
      video: rejectedVideo,
      expected: { title: patch.title },
    },
    {
      scenario: 'the owner of a ready video',
      user: creatorUser,
      video: publicVideo,
      expected: patch,
    },
    {
      scenario: 'an admin over a taken-down video',
      user: adminUser,
      video: rejectedVideo,
      expected: patch,
    },
  ])('update, $scenario', ({ user, video, expected }) => {
    expect(
      pickPermittedFields({
        ability: getUserPermissions(user),
        action: 'update',
        subject: toVideoSubject(video),
        data: patch,
      })
    ).toEqual(expected);
  });

  it('leaves the input untouched and returns a new object', () => {
    const data = { title: 'a', visibility: 'public' };
    const picked = pickPermittedFields({
      ability: getUserPermissions(creatorUser),
      action: 'update',
      subject: toVideoSubject(rejectedVideo),
      data,
    });

    expect(picked).not.toBe(data);
    expect(data).toEqual({ title: 'a', visibility: 'public' });
  });
});
