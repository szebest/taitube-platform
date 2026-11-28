import { parseVideoId } from '../parse-video-id';

const ID = '0190c3a0-5e1d-7000-8000-00000000c001';

describe('apps/client/web: parseVideoId', () => {
  it.each([
    { scenario: 'a watch link', text: `https://taitube.test/watch/${ID}?t=30`, expected: ID },
    { scenario: 'a bare ID with spaces around it', text: `  ${ID} `, expected: ID },
    {
      scenario: 'a link with no video',
      text: 'https://taitube.test/feed/trending',
      expected: null,
    },
    { scenario: 'words', text: 'big buck bunny', expected: null },
    { scenario: 'nothing', text: '', expected: null },
  ])('reads $scenario', ({ text, expected }) => {
    expect(parseVideoId(text)).toBe(expected);
  });
});
