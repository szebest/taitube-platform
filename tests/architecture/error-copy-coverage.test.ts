import { ErrorCodes } from '@vp/errors';
import { ERROR_COPY, en } from '@vp/messages';

/**
 * The API answers with a code and the client chooses the words (SDD ADR-24, ADR-26). A code with no
 * copy renders nothing a person can act on, and a copy key that names no message renders nothing at
 * all, so both are held here against the real vocabulary and catalogue.
 */
type Copy = Readonly<Record<string, string>>;
type Catalogue = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

function uncovered(codes: readonly string[], copy: Copy): string[] {
  return codes.filter((code) => copy[code] === undefined);
}

function dangling(copy: Copy, catalogue: Catalogue): string[] {
  return Object.values(copy).filter((key) => {
    const [feature = '', name = ''] = key.split('.');
    return catalogue[feature]?.[name] === undefined;
  });
}

describe('architecture: every error code has user-facing copy', () => {
  it('names the code a planted map leaves out', () => {
    const planted = { INTERNAL: 'errors.internal' };

    expect(uncovered(['INTERNAL', 'VIDEO_NOT_FOUND'], planted)).toEqual(['VIDEO_NOT_FOUND']);
  });

  it('names the key a planted map points at no message', () => {
    expect(dangling({ INTERNAL: 'errors.gone' }, en)).toEqual(['errors.gone']);
  });

  it('gives every code in the vocabulary an entry in ERROR_COPY', () => {
    expect(uncovered(Object.values(ErrorCodes), ERROR_COPY)).toEqual([]);
  });

  it('points every entry at a message the en catalogue holds', () => {
    expect(dangling(ERROR_COPY, en)).toEqual([]);
  });
});
