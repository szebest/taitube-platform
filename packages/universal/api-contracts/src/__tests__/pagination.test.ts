import { KeysetQuerySchema, PageLimitSchema, decodeCursorPayload } from '../pagination';

function encode(payload: unknown): string {
  const json = JSON.stringify(payload);
  const binary = String.fromCharCode(...new TextEncoder().encode(json));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('packages/api-contracts: pagination', () => {
  it('decodes a base64url cursor payload', () => {
    expect(
      decodeCursorPayload(encode({ id: 'v1', createdAt: '2026-01-01T00:00:00.000Z' }))
    ).toEqual({ id: 'v1', createdAt: '2026-01-01T00:00:00.000Z' });
  });

  it.each([['not-base64url!!'], [encode([1, 2])], [encode('scalar')]])(
    'rejects %s as a cursor payload',
    (cursor) => {
      expect(decodeCursorPayload(cursor)).toBeNull();
    }
  );

  it('defaults the page limit to 20 and coerces a string', () => {
    expect(PageLimitSchema.parse(undefined)).toBe(20);
    expect(PageLimitSchema.parse('50')).toBe(50);
    expect(PageLimitSchema.safeParse('101').success).toBe(false);
  });

  it('makes the cursor optional on a keyset query', () => {
    expect(KeysetQuerySchema.parse({})).toEqual({ limit: 20 });
  });
});
