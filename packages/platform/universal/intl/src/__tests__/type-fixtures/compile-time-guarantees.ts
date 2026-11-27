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
