import type { FormatValue } from '@vp/intl';
import { unwrapOr } from '@vp/result';
import { useFormat } from './use-format';

export interface FormatProps {
  readonly value: FormatValue;
  /** Rendered when the value cannot be formatted; the page keeps its layout either way. */
  readonly fallback?: string;
}

export function Format({ value, fallback = '' }: FormatProps) {
  const { format } = useFormat();
  return <>{unwrapOr(format(value), fallback)}</>;
}
