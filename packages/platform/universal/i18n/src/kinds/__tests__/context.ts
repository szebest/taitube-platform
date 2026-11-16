import { ok } from '@vp/result';
import { intlFor } from '../../__tests__/fixtures';
import type { KindContext } from '../../kind';

/** A kind's context whose nested render shows what it was asked for, so a spec sees the delegation. */
export function contextFor(locale: string): KindContext {
  return {
    intl: intlFor(locale),
    render: (kind, value, entry) => ok(`${kind}(${String(value)}, ${JSON.stringify(entry)})`),
  };
}
