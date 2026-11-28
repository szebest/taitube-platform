import { number } from '@kit/intl';
import { isConfigKey, isRecord, messageKind } from '../kind';

describe('@kit/i18n: messageKind', () => {
  it('is the intl kind itself, with its requirement as frozen data', () => {
    const kind = messageKind(number, 'optional');

    expect([kind.name, kind.config, kind.render, Object.isFrozen(kind)]).toEqual([
      'number',
      'optional',
      number.render,
      true,
    ]);
  });

  it.each([
    { value: 'ready', expected: true },
    { value: 1, expected: false },
  ])('isConfigKey($value) is $expected', ({ value, expected }) => {
    expect(isConfigKey(value)).toBe(expected);
  });

  it.each([
    { value: {}, expected: true },
    { value: [], expected: false },
    { value: null, expected: false },
    { value: 'x', expected: false },
  ])('isRecord($value) is $expected', ({ value, expected }) => {
    expect(isRecord(value)).toBe(expected);
  });
});
