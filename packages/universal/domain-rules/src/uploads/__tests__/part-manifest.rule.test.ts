import { isErr, isOk } from '@vp/result';
import { anUpload } from '../../__tests__/entities';
import { decidePartManifest } from '../part-manifest.rule';

const upload = anUpload({ strategy: 'multipart', partsExpected: 2 });
const parts = [
  { partNumber: 1, etag: 'a' },
  { partNumber: 2, etag: 'b' },
];

describe('@vp/domain-rules: decidePartManifest', () => {
  it('accepts a manifest matching the expected count', () => {
    expect(isOk(decidePartManifest({ upload, parts }))).toBe(true);
  });

  it.each([
    { name: 'no parts at all', parts: undefined },
    { name: 'an empty list', parts: [] },
    { name: 'too few parts', parts: parts.slice(0, 1) },
    { name: 'too many parts', parts: [...parts, { partNumber: 3, etag: 'c' }] },
  ])('rejects $name', ({ parts: given }) => {
    expect(isErr(decidePartManifest({ upload, parts: given }))).toBe(true);
  });

  it('rejects an upload record with no expected part count', () => {
    const result = decidePartManifest({ upload: anUpload({ partsExpected: null }), parts });

    expect(isErr(result) && result.error.expected).toBeNull();
  });
});
