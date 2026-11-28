import { andThen, map } from '@kit/result';
import { DATE_RESOLUTION, type DateStyle, resolveDateOptions } from '../format-instant';
import { isString, parseCalendarDate } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

const PLAIN_DATE_FIELD_KEYS = [
  'weekday',
  'era',
  'year',
  'month',
  'day',
] as const satisfies OptionKeys<Intl.DateTimeFormatOptions>;

const PLAIN_DATE_OPTION_KEYS = ['style', ...PLAIN_DATE_FIELD_KEYS] as const satisfies OptionKeys<
  Intl.DateTimeFormatOptions,
  'style'
>;

type PlainDateOptions = Pick<Intl.DateTimeFormatOptions, (typeof PLAIN_DATE_FIELD_KEYS)[number]> & {
  readonly style?: DateStyle;
};

/** A calendar date with no zone, `2024-05-01`: a birthday or a publish day reads the same everywhere. */
export const plainDate = defineKind({
  name: 'plainDate',
  arg: isString,
  options: optionKeys<PlainDateOptions>(PLAIN_DATE_OPTION_KEYS),
  render: (value, options, context) => {
    const intlOptions = { ...resolveDateOptions(options ?? {}, DATE_RESOLUTION), timeZone: 'UTC' };
    return andThen(parseCalendarDate('plainDate', value), (day) =>
      map(context.cache.dateTimeFormat(context.locale, intlOptions), (format) => format.format(day))
    );
  },
});

/** @public */
export type PlainDateValue = TaggedOf<typeof plainDate>;
