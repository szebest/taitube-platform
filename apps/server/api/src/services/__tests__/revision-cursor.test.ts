import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@vp/testing/result';
import { decodeRevisionCursor, revisionCursorPayload } from '../revision-cursor';

const paginator = new Paginator();

describe('apps/server/api/services: revision cursor', () => {
  it('reads an absent cursor as the first page', () => {
    expect(expectOk(decodeRevisionCursor(undefined, paginator))).toBeNull();
  });

  it('reads back the version it was minted from', () => {
    const cursor = paginator.encodeCursor(revisionCursorPayload({ version: 7 }));

    expect(expectOk(decodeRevisionCursor(cursor, paginator))).toBe(7);
  });

  it.each<{ name: string; payload: Record<string, string | number> }>([
    { name: 'a version that is not a number', payload: { version: 'x' } },
    { name: 'a fractional version', payload: { version: 1.5 } },
    { name: 'a negative version', payload: { version: -1 } },
    { name: 'a payload without a version', payload: { id: 'x' } },
  ])('refuses $name', ({ payload }) => {
    expect(expectErr(decodeRevisionCursor(paginator.encodeCursor(payload), paginator)).code).toBe(
      'INVALID_CURSOR'
    );
  });

  it('refuses text that is not a cursor', () => {
    expect(expectErr(decodeRevisionCursor('!!', paginator)).code).toBe('INVALID_CURSOR');
  });
});
