import { map } from '@vp/result';
import { type OptionKeys, withOptions } from '../with-options';

export const LIST_OPTION_KEYS = [
  'type',
  'style',
] as const satisfies OptionKeys<Intl.ListFormatOptions>;

export type ListOptions = Pick<Intl.ListFormatOptions, (typeof LIST_OPTION_KEYS)[number]>;

export interface ListValue {
  readonly type: 'list';
  readonly value: readonly string[];
  readonly options?: ListOptions;
}

export const list = withOptions<ListValue>('list', LIST_OPTION_KEYS, (value, context) =>
  map(context.cache.listFormat(context.locale, value.options), (format) =>
    format.format(value.value)
  )
);
