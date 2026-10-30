import { z } from 'zod';

import { lenient } from '../lenient';

describe('apps/client/studio: lenient', () => {
  const schema = lenient(z.enum(['a', 'b']).optional());

  it.each([
    { scenario: 'a value the schema accepts', value: 'a', expected: 'a' },
    { scenario: 'a value the schema refuses', value: 'c', expected: undefined },
    { scenario: 'no value', value: undefined, expected: undefined },
  ])('reads $scenario', ({ value, expected }) => {
    expect(schema.parse(value)).toBe(expected);
  });
});
