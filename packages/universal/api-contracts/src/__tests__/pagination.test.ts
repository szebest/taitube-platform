import { KeysetQuerySchema, PageLimitSchema } from '../pagination';

describe('packages/api-contracts: pagination', () => {
  it('defaults the page limit to 20 and coerces a string', () => {
    expect(PageLimitSchema.parse(undefined)).toBe(20);
    expect(PageLimitSchema.parse('50')).toBe(50);
    expect(PageLimitSchema.safeParse('101').success).toBe(false);
  });

  it('makes the cursor optional on a keyset query', () => {
    expect(KeysetQuerySchema.parse({})).toEqual({ limit: 20 });
  });
});
