import { ErrorCodes } from '@vp/errors';
import { uuid } from '#app/__tests__/library-fixtures';
import { summarizeItemResults } from '../summarize-item-results';

describe('apps/client/web: summarizeItemResults', () => {
  it('counts what landed and what was a duplicate, and names each refusal with its reason', () => {
    expect(
      summarizeItemResults([
        { itemId: uuid(1), ok: true, duplicate: false },
        { itemId: uuid(2), ok: true, duplicate: false },
        { itemId: uuid(3), ok: true, duplicate: true },
        { itemId: uuid(4), ok: false, duplicate: false, code: ErrorCodes.FORBIDDEN },
        { itemId: uuid(5), ok: false, duplicate: false },
      ])
    ).toEqual({
      landed: 2,
      duplicates: 1,
      refused: [
        { itemId: uuid(4), code: ErrorCodes.FORBIDDEN },
        { itemId: uuid(5), code: 'UNKNOWN' },
      ],
    });
  });
});
