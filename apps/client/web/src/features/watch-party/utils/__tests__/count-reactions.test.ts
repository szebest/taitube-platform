import { countReactions } from '../count-reactions';

describe('apps/client/web: countReactions', () => {
  it('adds counts per emoji, keeping first-seen order', () => {
    expect(
      countReactions([
        { emoji: '🔥', count: 1 },
        { emoji: '🎉', count: 2 },
        { emoji: '🔥', count: 3 },
      ])
    ).toEqual([
      { emoji: '🔥', count: 4 },
      { emoji: '🎉', count: 2 },
    ]);
  });
});
