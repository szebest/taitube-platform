import { ErrorCodes } from '@vp/errors';
import { err, ok } from '@vp/result';
import {
  Base64UrlCursorCodec,
  type CursorCodec,
  type CursorPayload,
  JsonCursorCodec,
} from '../cursor-codec';

describe('packages/pagination: cursor codecs', () => {
  const codecs: Array<{ name: string; codec: CursorCodec }> = [
    { name: 'Base64UrlCursorCodec', codec: new Base64UrlCursorCodec() },
    { name: 'JsonCursorCodec', codec: new JsonCursorCodec() },
  ];

  describe.each(codecs)('$name', ({ codec }) => {
    const payloads: Array<{ scenario: string; payload: CursorPayload }> = [
      {
        scenario: 'a keyset of strings',
        payload: { createdAt: '2026-01-01T00:00:00.000Z', id: 'v1' },
      },
      {
        scenario: 'a keyset with a number',
        payload: { sort: 'popular', viewsCount: 42, id: 'v1' },
      },
      { scenario: 'a single key', payload: { id: 'v1' } },
      { scenario: 'a value needing escaping', payload: { id: 'a/b+c=d "e"' } },
      { scenario: 'a non-ASCII value', payload: { id: 'ちゃんねる-café' } },
    ];

    it.each(payloads)('round-trips $scenario', ({ payload }) => {
      expect(codec.decode(codec.encode(payload))).toEqual(ok(payload));
    });

    it.each([
      { scenario: 'unparseable text', cursor: 'not-a-cursor!!' },
      { scenario: 'a JSON array', cursor: codec.encode({ id: 'x' }).slice(0, 2) },
    ])('rejects $scenario as INVALID_CURSOR', ({ cursor }) => {
      expect(codec.decode(cursor)).toEqual(
        err({
          code: ErrorCodes.INVALID_CURSOR,
          message: 'Invalid pagination cursor',
          field: 'cursor',
        })
      );
    });
  });

  it('produces a URL-safe token carrying no padding or reserved characters', () => {
    const cursor = new Base64UrlCursorCodec().encode({
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'v1',
    });

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(cursor)).toBe(cursor);
  });

  it.each([
    { scenario: 'a JSON array', raw: '["not","an","object"]' },
    { scenario: 'a JSON scalar', raw: '"just-a-string"' },
    { scenario: 'JSON null', raw: 'null' },
  ])('rejects $scenario that is not a keyset object', ({ raw }) => {
    expect(new JsonCursorCodec().decode(raw).ok).toBe(false);
  });
});
