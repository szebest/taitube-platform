import type { BytesValue } from '@kit/intl';

/** @public */
export function fileSize(byteCount: number): BytesValue {
  return { type: 'bytes', value: byteCount, options: { base: 'decimal' } };
}
