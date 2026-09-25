import { newVideoRecord } from '../new-video-record';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const REQUIRED = {
  id: '00000000-0000-7000-8000-0000000000c1',
  ownerId: '00000000-0000-7000-8000-0000000000c2',
  sourceKey: 'raw/c1/source.mp4',
};

describe('newVideoRecord', () => {
  it('fills every column the caller left out with its database default', () => {
    expect(newVideoRecord(REQUIRED, NOW)).toStrictEqual({
      ...REQUIRED,
      title: null,
      description: null,
      visibility: 'private',
      status: 'UPLOADING',
      sourceSizeBytes: null,
      durationMs: null,
      width: null,
      height: null,
      fps: null,
      ladder: null,
      masterPlaylistKey: null,
      posterKey: null,
      spriteKey: null,
      playbackUrl: null,
      posterUrl: null,
      spriteUrl: null,
      spriteVttUrl: null,
      errorCode: null,
      errorMessage: null,
      viewsCount: 0,
      likesCount: 0,
      dislikesCount: 0,
      categoryId: null,
      generation: 1,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      readyAt: null,
      deletedAt: null,
    });
  });

  it('keeps what the caller supplied over the defaults', () => {
    const record = newVideoRecord(
      { ...REQUIRED, title: 'Given', visibility: 'public', viewsCount: 9, generation: 3 },
      NOW
    );

    expect(record).toMatchObject({
      title: 'Given',
      visibility: 'public',
      viewsCount: 9,
      generation: 3,
    });
  });

  it.each([
    {
      scenario: 'stamps readyAt with now for a video created READY',
      input: { status: 'READY' as const },
      readyAt: NOW,
    },
    {
      scenario: 'keeps a readyAt the caller supplied',
      input: { status: 'READY' as const, readyAt: new Date('2026-01-01T00:00:00.000Z') },
      readyAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      scenario: 'leaves readyAt empty for a video that is not READY',
      input: { status: 'PROCESSING' as const },
      readyAt: null,
    },
  ])('$scenario', ({ input, readyAt }) => {
    expect(newVideoRecord({ ...REQUIRED, ...input }, NOW).readyAt).toEqual(readyAt);
  });
});
