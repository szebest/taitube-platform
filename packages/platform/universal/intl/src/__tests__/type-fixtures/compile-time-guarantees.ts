import { createIntl } from '../../create-intl';
import type { FormatValue, TaggedValue } from '../../format-value';
import { formatKinds } from '../../format-value';
import { type OptionKeys, defineKind, optionKeys } from '../../kind';
import { defineLocales } from '../../locales';
import { contextFor } from '../fixtures';

expectTypeOf<TaggedValue['type']>().toEqualTypeOf<
  | 'count'
  | 'number'
  | 'percent'
  | 'bytes'
  | 'bitrate'
  | 'numberRange'
  | 'money'
  | 'date'
  | 'time'
  | 'dateTime'
  | 'dateRange'
  | 'plainDate'
  | 'relative'
  | 'calendarDay'
  | 'duration'
  | 'list'
  | 'displayName'
  | 'truncate'
>();

// @ts-expect-error a kind the registry does not hold is no tagged value
const _unknownKind: FormatValue = { type: 'rating', value: 5 };

// @ts-expect-error displayName cannot render without saying which names it reads
const _noOf: FormatValue = { type: 'displayName', value: 'sv' };

const rating = defineKind({
  name: 'rating',
  arg: (value): value is number => typeof value === 'number',
  options: optionKeys<{ readonly stars?: number }>(['stars']),
  render: (value, _, context) => context.format(value),
});
const withRating = createIntl(contextFor('en'), [...formatKinds, rating]);
withRating.format({ type: 'rating', value: 4, options: { stars: 5 } });

// @ts-expect-error the registered kind's argument is a number
withRating.format({ type: 'rating', value: 'four' });

expectTypeOf(createIntl(contextFor('en')).call('pluralCategory', 1)).toEqualTypeOf<
  ReturnType<typeof withRating.call<'pluralCategory'>>
>();

// @ts-expect-error a misspelt allowlist key fails where it is declared
optionKeys<{ readonly stars?: number }>(['starz']);

const _declared = ['maximumFractionDigits'] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

// @ts-expect-error a misspelt option key fails where the allowlist is declared
const _misspelt = ['maximumFractionDigts'] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

const _ours = ['base'] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'base'>;

const locales = defineLocales({
  source: 'en',
  details: { en: { name: 'English', direction: 'ltr' }, he: { name: 'עברית', direction: 'rtl' } },
});
expectTypeOf(locales.tags).toEqualTypeOf<readonly ('en' | 'he')[]>();

// @ts-expect-error the source locale must be one the app registers
defineLocales({ source: 'de', details: { en: { name: 'English', direction: 'ltr' } } });

// @ts-expect-error a direction is ltr or rtl
defineLocales({ source: 'en', details: { en: { name: 'English', direction: 'up' } } });

const _options: readonly FormatValue[] = [
  { type: 'number', value: 1, options: { roundingMode: 'floor', trailingZeroDisplay: 'auto' } },
  { type: 'count', value: 1, options: { roundingMode: 'ceil', signDisplay: 'always' } },
  { type: 'percent', value: 1, options: { input: 'fraction', maximumSignificantDigits: 2 } },
  { type: 'money', value: 1, options: { currencySign: 'accounting', notation: 'compact' } },
  { type: 'bytes', value: 1, options: { minUnit: 'kilobyte', roundingMode: 'floor' } },
  { type: 'bitrate', value: 1, options: { minUnit: 'kilobit-per-second' } },
  { type: 'date', value: '', options: { timeZone: 'Asia/Tokyo', calendar: 'japanese' } },
  { type: 'time', value: '', options: { timeZone: 'Asia/Tokyo', fractionalSecondDigits: 3 } },
  { type: 'dateTime', value: '', options: { dateStyle: 'full', timeStyle: 'short' } },
  { type: 'dateRange', value: ['', ''], options: { hour: 'numeric', timeZone: 'UTC' } },
  { type: 'calendarDay', value: '', options: { withTime: false, windowDays: 3, style: 'long' } },
  { type: 'relative', value: '', options: { minUnit: 'minute', maxUnit: 'day' } },
  { type: 'displayName', value: 'GB', options: { of: 'region', style: 'short' } },
  { type: 'duration', value: 1, options: { unit: 'milliseconds', maxUnits: 2 } },
];

// @ts-expect-error a bytes size is never shown below a unit it does not know
const _minUnit: FormatValue = { type: 'bytes', value: 1, options: { minUnit: 'kb' } };

// @ts-expect-error percent reads points or a fraction
const _input: FormatValue = { type: 'percent', value: 1, options: { input: 'ratio' } };

// @ts-expect-error money has no per-value zone
const _moneyZone: FormatValue = { type: 'money', value: 1, options: { timeZone: 'UTC' } };
