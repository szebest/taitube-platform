import {
  diffSnapshots,
  videoMetadataSnapshot,
  type VideoMetadataSnapshot,
} from '../entity-revision';

const base: VideoMetadataSnapshot = {
  title: 'T',
  description: 'D',
  tags: ['a'],
  categoryId: null,
  visibility: 'public',
  thumbnail: { source: 'poster' },
  chapters: [{ startMs: 0, title: 'Intro' }],
  commentsEnabled: true,
};

describe('@vp/domain: videoMetadataSnapshot', () => {
  it('copies the editable fields and defaults the optional ones', () => {
    const snapshot = videoMetadataSnapshot({ title: 'T', description: 'D', visibility: 'public' }, [
      { startMs: 0, title: 'Intro' },
    ]);

    expect(snapshot).toEqual({ ...base, tags: [] });
  });
});

describe('@vp/domain: diffSnapshots', () => {
  it.each([
    { name: 'nothing', to: base, fields: [] },
    { name: 'a title', to: { ...base, title: 'U' }, fields: ['title'] },
    {
      name: 'tags and visibility',
      to: { ...base, tags: ['b'], visibility: 'private' as const },
      fields: ['tags', 'visibility'],
    },
    { name: 'chapters', to: { ...base, chapters: [] }, fields: ['chapters'] },
    {
      name: 'the comments switch',
      to: { ...base, commentsEnabled: false },
      fields: ['commentsEnabled'],
    },
  ])('lists $name', ({ to, fields }) => {
    expect(diffSnapshots(base, to)).toEqual(fields);
  });
});
