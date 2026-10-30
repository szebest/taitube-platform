import {
  applyFeedback,
  type HiddenFeedback,
  isHidden,
  withoutHidden,
} from '../recommendation-feedback';

const hiddenOf = (videoIds: string[] = [], channelIds: string[] = []): HiddenFeedback => ({
  videoIds: new Set(videoIds),
  channelIds: new Set(channelIds),
});

const item = (id: string, channelId: string | null = null) => ({
  id,
  channel: channelId ? { id: channelId } : null,
});

describe('domain: recommendation feedback', () => {
  describe('isHidden', () => {
    it.each([
      { scenario: 'a hidden video', video: item('v1', 'c1'), hidden: hiddenOf(['v1']), out: true },
      {
        scenario: 'a video of a hidden channel',
        video: item('v1', 'c1'),
        hidden: hiddenOf([], ['c1']),
        out: true,
      },
      { scenario: 'nothing hidden', video: item('v1', 'c1'), hidden: hiddenOf(), out: false },
      {
        scenario: 'another video and channel',
        video: item('v1', 'c1'),
        hidden: hiddenOf(['v2'], ['c2']),
        out: false,
      },
      {
        scenario: 'a video without a channel',
        video: item('v1'),
        hidden: hiddenOf([], ['c1']),
        out: false,
      },
      {
        scenario: 'an item with no channel field',
        video: { id: 'v1' },
        hidden: hiddenOf(['v1']),
        out: true,
      },
    ])('$scenario: $out', ({ video, hidden, out }) => {
      expect(isHidden(video, hidden)).toBe(out);
    });
  });

  it('keeps the order of what stays', () => {
    const items = [item('a', 'c1'), item('b', 'c2'), item('c', 'c1'), item('d', 'c3')];

    expect(withoutHidden(items, hiddenOf(['d'], ['c1'])).map(({ id }) => id)).toEqual(['b']);
  });

  describe('applyFeedback', () => {
    const shelf = (kind: string, ...items: ReturnType<typeof item>[]) => ({ kind, items });
    const idsByKind = (shelves: ReturnType<typeof shelf>[]) =>
      shelves.map(({ kind, items }) => [kind, items.map(({ id }) => id)]);

    it.each([
      {
        scenario: 'a hidden video leaves its shelf',
        shelves: [shelf('trending', item('a'), item('b'))],
        hidden: hiddenOf(['a']),
        expected: [['trending', ['b']]],
      },
      {
        scenario: 'a hidden channel leaves every shelf',
        shelves: [
          shelf('trending', item('a', 'c1'), item('b', 'c2')),
          shelf('category', item('c', 'c1'), item('d', 'c2')),
        ],
        hidden: hiddenOf([], ['c1']),
        expected: [
          ['trending', ['b']],
          ['category', ['d']],
        ],
      },
      {
        scenario: 'a shelf left empty is dropped',
        shelves: [shelf('because-watched', item('a', 'c1')), shelf('trending', item('b'))],
        hidden: hiddenOf([], ['c1']),
        expected: [['trending', ['b']]],
      },
      {
        scenario: 'continue and subscriptions are exempt',
        shelves: [
          shelf('continue', item('a', 'c1')),
          shelf('subscriptions', item('b', 'c1')),
          shelf('trending', item('c', 'c1')),
        ],
        hidden: hiddenOf(['a', 'b', 'c'], ['c1']),
        expected: [
          ['continue', ['a']],
          ['subscriptions', ['b']],
        ],
      },
      {
        scenario: 'nothing hidden changes nothing',
        shelves: [shelf('trending', item('a'), item('b'))],
        hidden: hiddenOf(),
        expected: [['trending', ['a', 'b']]],
      },
    ])('$scenario', ({ shelves, hidden, expected }) => {
      expect(idsByKind(applyFeedback(shelves, hidden))).toEqual(expected);
    });

    it('keeps the other fields of a shelf', () => {
      const [kept] = applyFeedback(
        [{ kind: 'category', subject: { id: 's' }, items: [item('a'), item('b')] }],
        hiddenOf(['a'])
      );

      expect(kept?.subject).toEqual({ id: 's' });
    });
  });
});
