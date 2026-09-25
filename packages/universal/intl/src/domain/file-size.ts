import type { BytesValue } from '../formatters/bytes';

/** @public */
export function fileSize(byteCount: number): BytesValue {
  return { type: 'bytes', value: byteCount, options: { base: 'decimal' } };
}
