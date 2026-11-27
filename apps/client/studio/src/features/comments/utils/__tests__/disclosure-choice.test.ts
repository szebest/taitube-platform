import { chosenDisclosure, needsReason } from '../disclosure-choice';

describe('apps/client/studio: chosenDisclosure', () => {
  it.each([
    { channelDefault: 'silent', flipped: false, expected: 'silent' },
    { channelDefault: 'visible', flipped: false, expected: 'visible' },
    { channelDefault: 'silent', flipped: true, expected: 'visible' },
    { channelDefault: 'visible', flipped: true, expected: 'silent' },
    { channelDefault: undefined, flipped: false, expected: undefined },
    { channelDefault: undefined, flipped: true, expected: 'visible' },
  ] as const)(
    'gives $expected for the default $channelDefault, flipped: $flipped',
    ({ channelDefault, flipped, expected }) => {
      expect(chosenDisclosure(channelDefault, flipped)).toBe(expected);
    }
  );
});

describe('apps/client/studio: needsReason', () => {
  it.each([
    { disclosure: 'silent', expected: false },
    { disclosure: 'visible', expected: true },
    { disclosure: undefined, expected: true },
  ] as const)('answers $expected for $disclosure', ({ disclosure, expected }) => {
    expect(needsReason(disclosure)).toBe(expected);
  });
});
