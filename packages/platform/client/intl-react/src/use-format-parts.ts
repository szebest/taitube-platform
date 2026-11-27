import { type FormatFailure, type ListDetail, type ListValue, list, runParts } from '@kit/intl';
import type { Result } from '@kit/result';
import { useIntlBindings } from './intl-context';

/** The structure of a list for a UI that renders its "and N more" as more than text. */
export function useFormatParts(): (value: ListValue) => Result<ListDetail, FormatFailure> {
  const { context } = useIntlBindings('useFormatParts').intl;
  return ({ value, options }) => runParts(list, value, options, context);
}
