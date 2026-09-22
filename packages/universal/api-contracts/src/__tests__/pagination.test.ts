import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@vp/pagination';
import { KeysetQuerySchema, PageLimitSchema } from '../pagination';

describe('packages/api-contracts: pagination', () => {
  it('defaults the page limit to 20 and coerces a string', () => {
    expect(PageLimitSchema.parse(undefined)).toBe(20);
    expect(PageLimitSchema.parse('50')).toBe(50);
    expect(PageLimitSchema.safeParse('101').success).toBe(false);
  });

  it('takes both bounds from the shared page-size constants', () => {
    expect(PageLimitSchema.parse(undefined)).toBe(PAGE_SIZE_DEFAULT);
    expect(PageLimitSchema.safeParse(PAGE_SIZE_MAX).success).toBe(true);
    expect(PageLimitSchema.safeParse(PAGE_SIZE_MAX + 1).success).toBe(false);
  });

  it('warns a consumer that a deployment may clamp below the advertised maximum', () => {
    expect(PageLimitSchema.description).toContain('PAGE_SIZE_MAX');
    expect(PageLimitSchema.description).toContain('clamp');
  });

  it('makes the cursor optional on a keyset query', () => {
    expect(KeysetQuerySchema.parse({})).toEqual({ limit: 20 });
  });
});
