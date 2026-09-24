import { toUploadSubject, toVideoSubject } from '../subject-wrapper';

describe('normalizers/subject-wrapper: CASL Subject Wrappers', () => {
  it.each<{
    scenario: string;
    build: () => object | undefined;
    expected: Record<string, unknown>;
  }>([
    {
      scenario: 'toVideoSubject resolves ownerId from userId and defaults visibility',
      build: () => toVideoSubject({ id: 'v1', userId: 'u1' }),
      expected: { ownerId: 'u1', visibility: 'public' },
    },
    {
      scenario: 'toUploadSubject falls back to the owner of the video',
      build: () => toUploadSubject(null, { ownerId: 'owner-1' }),
      expected: { ownerId: 'owner-1' },
    },
  ])('$scenario', ({ build, expected }) => {
    expect(build()).toMatchObject(expected);
  });

  it('returns no subject when the resource normalized away', () => {
    expect(toVideoSubject(null)).toBeUndefined();
  });
});
