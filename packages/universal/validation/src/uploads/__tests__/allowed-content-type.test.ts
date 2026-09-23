import { isErr, isOk } from '@vp/result';
import {
  ALLOWED_CONTENT_TYPES,
  CONTENT_TYPE_EXTENSIONS,
  validateContentType,
} from '../allowed-content-type';

describe('@vp/validation: allowed content types', () => {
  it.each(ALLOWED_CONTENT_TYPES.map((contentType) => ({ contentType })))(
    'accepts $contentType',
    ({ contentType }) => {
      expect(isOk(validateContentType(contentType, ALLOWED_CONTENT_TYPES))).toBe(true);
    }
  );

  it.each([{ contentType: 'image/png' }, { contentType: 'text/plain' }, { contentType: '' }])(
    'rejects $contentType',
    ({ contentType }) => {
      expect(isErr(validateContentType(contentType, ALLOWED_CONTENT_TYPES))).toBe(true);
    }
  );

  it('honours a narrower allowed list supplied by the caller', () => {
    expect(isErr(validateContentType('video/webm', ['video/mp4']))).toBe(true);
  });

  it('gives every allowed type an extension the browser can put in its accept map', () => {
    expect(Object.keys(CONTENT_TYPE_EXTENSIONS).sort()).toEqual([...ALLOWED_CONTENT_TYPES].sort());
  });
});
