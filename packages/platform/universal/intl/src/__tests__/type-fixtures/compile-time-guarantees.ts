import type { FormatKind, KindsMatchUnion, TaggedValue } from '../../format-value';
import { defineLocales } from '../../locales';
import type { OptionKeys } from '../../with-options';

const _complete: KindsMatchUnion<FormatKind, TaggedValue['type']> = true;

// @ts-expect-error a kind added to the list with no member in the union
const _kindWithoutMember: KindsMatchUnion<FormatKind | 'rating', TaggedValue['type']> = true;

// @ts-expect-error a member added to the union with no entry in the kind list
const _memberWithoutKind: KindsMatchUnion<Exclude<FormatKind, 'money'>, TaggedValue['type']> = true;

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
