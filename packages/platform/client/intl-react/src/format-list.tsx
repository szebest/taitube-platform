import type { ListItem, ListOptions } from '@kit/intl';
import { isOk } from '@kit/result';
import { ListPartView, type ListPartViewProps } from './list-part-view';
import { useFormatParts } from './use-format-parts';

/** @internal */
export interface FormatListProps extends Pick<ListPartViewProps, 'moreTooltip'> {
  readonly value: readonly ListItem[];
  readonly options?: ListOptions;
  /** Rendered when the list cannot be formatted. */
  readonly fallback?: string;
}

/**
 * One list, collapsing past `options.max` into a trigger that opens every item.
 * @internal
 */
export function FormatList({ value, options, moreTooltip, fallback = '' }: FormatListProps) {
  const formatParts = useFormatParts();
  const result = formatParts({ type: 'list', value, options });
  if (!isOk(result)) return <>{fallback}</>;
  return <ListPartView detail={result.value} moreTooltip={moreTooltip} />;
}
