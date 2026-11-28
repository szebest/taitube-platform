import { resolvePlaylistImportLine } from '../playlist-import-line.rule';

const WEB = 'https://taitube.local';
const ID = '0190d0a1-2b3c-7d4e-8f90-1a2b3c4d5e6f';

describe('@vp/domain-rules: resolvePlaylistImportLine', () => {
  it.each([
    {
      scenario: 'a bare id',
      line: ` ${ID.toUpperCase()} `,
      expected: { type: 'video', videoId: ID },
    },
    {
      scenario: 'a watch page of this site',
      line: `${WEB}/watch/${ID}?t=30`,
      expected: { type: 'video', videoId: ID },
    },
    {
      scenario: 'a foreign watch page',
      line: `https://elsewhere.example/watch/${ID}`,
      expected: { type: 'unrecognised' },
    },
    { scenario: 'some words', line: 'my favourite video', expected: { type: 'unrecognised' } },
  ])('reads $scenario', ({ line, expected }) => {
    expect(resolvePlaylistImportLine(line, WEB)).toEqual(expected);
  });
});
