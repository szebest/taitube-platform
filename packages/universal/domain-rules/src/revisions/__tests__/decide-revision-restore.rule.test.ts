import type { VideoMetadataSnapshot } from '@vp/domain';
import { decideRevisionRestore } from '../decide-revision-restore.rule';

const current: VideoMetadataSnapshot = {
  title: 'New',
  description: 'Now',
  tags: ['b'],
  categoryId: 'c2',
  visibility: 'private',
  thumbnail: { source: 'poster' },
  chapters: [],
  commentsEnabled: false,
};

describe('@vp/domain-rules: decideRevisionRestore', () => {
  it('patches nothing when the snapshots match', () => {
    expect(decideRevisionRestore(current, current)).toEqual({});
  });

  it.each([
    { name: 'a title', target: { title: 'Old' }, patch: { title: 'Old' } },
    { name: 'a description', target: { description: 'Then' }, patch: { description: 'Then' } },
    { name: 'tags', target: { tags: ['a'] }, patch: { tags: ['a'] } },
    { name: 'a category cleared', target: { categoryId: null }, patch: { categoryId: null } },
    {
      name: 'visibility',
      target: { visibility: 'public' as const },
      patch: { visibility: 'public' },
    },
    {
      name: 'the comments switch',
      target: { commentsEnabled: true },
      patch: { commentsEnabled: true },
    },
    {
      name: 'chapters',
      target: { chapters: [{ startMs: 0, title: 'A' }] },
      patch: { chapters: [{ startMs: 0, title: 'A' }] },
    },
  ])('patches only $name', ({ target, patch }) => {
    expect(decideRevisionRestore(current, { ...current, ...target })).toEqual(patch);
  });
});
