import { useFormat, useT } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';

/** A track's language in the creator's own language, by its tag; the tag itself when the browser has no name for it. */
export function useLanguageLabel(): (language: string | null) => string {
  const { format } = useFormat();
  const { tOr } = useT();

  return (language) =>
    language === null
      ? tOr('studio.captionsLanguageUnknown', {}, '')
      : unwrapOr(format({ type: 'displayName', value: language, of: 'language' }), language);
}
