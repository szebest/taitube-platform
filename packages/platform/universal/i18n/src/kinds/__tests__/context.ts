import type { KindContext } from '@kit/intl';
import { ok } from '@kit/result';
import { intlFor } from '../../__tests__/fixtures';

/** A kind's context whose nested format shows what it was asked for, so a spec sees the delegation. */
export function contextFor(locale: string): KindContext {
  return {
    ...intlFor(locale).context,
    format: (value) =>
      ok(
        typeof value === 'object'
          ? `${value.type}(${String(value.value)}, ${JSON.stringify(value.options)})`
          : String(value)
      ),
  };
}
