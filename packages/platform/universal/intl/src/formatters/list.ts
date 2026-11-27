import { map } from '@kit/result';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

const LIST_OPTION_KEYS = ['type', 'style'] as const satisfies OptionKeys<Intl.ListFormatOptions>;

export type ListOptions = Pick<Intl.ListFormatOptions, (typeof LIST_OPTION_KEYS)[number]>;

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');

export const list = defineKind({
  name: 'list',
  arg: isStringList,
  options: optionKeys<ListOptions>(LIST_OPTION_KEYS),
  render: (value, options, context) =>
    map(context.cache.listFormat(context.locale, options), (format) => format.format(value)),
});

/** @public */
export type ListValue = TaggedOf<typeof list>;
