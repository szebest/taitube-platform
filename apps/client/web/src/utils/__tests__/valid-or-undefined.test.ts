import { z } from 'zod';
import { validOrUndefined } from '../valid-or-undefined';

const PageSchema = validOrUndefined(z.coerce.number().int().nonnegative());

describe('apps/client/web: validOrUndefined', () => {
  it.each([
    { raw: '3', read: 3 },
    { raw: 'soon', read: undefined },
    { raw: '-1', read: undefined },
    { raw: undefined, read: undefined },
  ])('reads $raw as $read', ({ raw, read }) => {
    expect(PageSchema.parse(raw)).toBe(read);
  });
});
