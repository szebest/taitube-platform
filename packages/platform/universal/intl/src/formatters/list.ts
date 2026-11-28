import { type Result, all, andThen, err, map, ok } from '@kit/result';
import { type FormatFailure, unrenderable } from '../failures';
import {
  type AnyTaggedValue,
  type KindContext,
  type OptionKeys,
  type TaggedOf,
  defineKind,
  optionKeys,
} from '../kind';
import { pluralCategory } from './plural';

const COUNT = '{?}';

/**
 * The "and 2 more" copy, by plural category: `other` always, `{?}` the hidden count.
 * @public
 */
export type MoreBranches = { readonly [Category in Intl.LDMLPluralRule]?: string } & {
  readonly other: string;
};

/**
 * Formats each raw item as this kind would: `{ kind: 'money' }` turns `1250` into a price.
 * @public
 */
export interface ListItemKind {
  readonly kind: string;
  readonly options?: unknown;
}

type ListShape = Pick<Intl.ListFormatOptions, 'type' | 'style'> & {
  readonly item?: ListItemKind;
};

/** `max` is the most items shown, `0` or absent for all; a collapsed list needs its `more` copy. */
export type ListOptions = ListShape &
  (
    | { readonly max?: 0; readonly more?: MoreBranches }
    | { readonly max: number; readonly more: MoreBranches }
  );

const LIST_OPTION_KEYS = ['type', 'style', 'max', 'more', 'item'] as const satisfies OptionKeys<
  Intl.ListFormatOptions,
  'max' | 'more' | 'item'
>;

/**
 * Text, a number, or a value of any kind, each formatted through the context.
 * @public
 */
export type ListItem = string | number | AnyTaggedValue;

/** @public */
export interface ListSegment {
  readonly type: 'item' | 'literal' | 'more';
  readonly value: string;
}

/**
 * A list as a UI renders it: the segments of what it shows, the items shown and hidden behind
 * "and N more", the whole list as text, and `text`, the segments joined, which `render` returns.
 */
export interface ListDetail {
  readonly segments: readonly ListSegment[];
  readonly visible: readonly string[];
  readonly hidden: readonly string[];
  readonly total: number;
  readonly full: string;
  readonly text: string;
}

interface Collapsed {
  readonly shown: readonly string[];
  readonly more: string | undefined;
}

const isItem = (value: unknown): value is ListItem =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  (typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string');

const isItemList = (value: unknown): value is readonly ListItem[] =>
  Array.isArray(value) && value.every(isItem);

function formatItems(
  items: readonly ListItem[],
  item: ListItemKind | undefined,
  context: KindContext
): Result<string[], FormatFailure> {
  return all(
    items.map((value) =>
      item === undefined || typeof value === 'object'
        ? context.format(value)
        : context.format({ type: item.kind, value, options: item.options })
    )
  );
}

function moreText(
  hidden: number,
  more: MoreBranches | undefined,
  context: KindContext
): Result<string, FormatFailure> {
  if (more === undefined) return err(unrenderable('list', 'max is set with no more copy'));
  return andThen(pluralCategory.render(hidden, undefined, context), (category) =>
    map(context.format({ type: 'number', value: hidden }), (count) =>
      (more[category] ?? more.other).replaceAll(COUNT, count)
    )
  );
}

function collapse(
  formatted: readonly string[],
  options: ListOptions,
  context: KindContext
): Result<Collapsed, FormatFailure> {
  const max = options.max ?? 0;
  if (!Number.isInteger(max) || max < 0) {
    return err(unrenderable('list', `max ${max} is not a whole number of items`));
  }
  if (max === 0 || max >= formatted.length) return ok({ shown: formatted, more: undefined });
  return map(moreText(formatted.length - max, options.more, context), (more) => ({
    shown: [...formatted.slice(0, max), more],
    more,
  }));
}

function listDetail(
  items: readonly ListItem[],
  options: ListOptions | undefined,
  context: KindContext
): Result<ListDetail, FormatFailure> {
  const settings = options ?? {};
  const { type, style } = settings;
  return andThen(formatItems(items, settings.item, context), (formatted) =>
    andThen(collapse(formatted, settings, context), ({ shown, more }) =>
      map(context.cache.listFormat(context.locale, { type, style }), (format) => {
        const visibleCount = more === undefined ? shown.length : shown.length - 1;
        let elements = 0;
        const segments = format.formatToParts(shown).map(({ type: part, value }): ListSegment => {
          if (part === 'literal') return { type: 'literal', value };
          elements += 1;
          return { type: elements > visibleCount ? 'more' : 'item', value };
        });
        return {
          segments,
          visible: formatted.slice(0, visibleCount),
          hidden: formatted.slice(visibleCount),
          total: formatted.length,
          full: format.format(formatted),
          text: segments.map(({ value }) => value).join(''),
        };
      })
    )
  );
}

/** Items joined the locale's way, collapsing past `max` into the app's own "and N more" copy. */
export const list = defineKind({
  name: 'list',
  arg: isItemList,
  options: optionKeys<ListOptions>(LIST_OPTION_KEYS),
  render: (items, options, context) => map(listDetail(items, options, context), ({ text }) => text),
  parts: listDetail,
});

/** @public */
export type ListValue = TaggedOf<typeof list>;
