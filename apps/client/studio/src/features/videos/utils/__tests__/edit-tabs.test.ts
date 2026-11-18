import { parseEditTab } from '../edit-tabs';

describe('apps/client/studio: parseEditTab', () => {
  it.each([
    { value: 'chapters', expected: 'chapters' },
    { value: 'history', expected: 'history' },
    { value: 'sharing', expected: undefined },
    { value: 3, expected: undefined },
    { value: undefined, expected: undefined },
  ])('reads $value as $expected', ({ value, expected }) => {
    expect(parseEditTab(value)).toBe(expected);
  });
});
