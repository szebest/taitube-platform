import type { MoneyValue } from '@kit/intl';
import { defineEngine } from '../../engine';
import { defineKind, isRecord } from '../../kind';
import { numberKind, pluralKind } from '../../kinds';
import type { ParamsOf } from '../../message';
import { defineParams } from '../../params';
import { definePresets } from '../../presets';
import { engine } from '../fixtures';

type MoneyOptions = NonNullable<MoneyValue['options']>;

const moneyKind = defineKind({
  name: 'money',
  config: 'optional',
  arg: (value): value is number => typeof value === 'number',
  options: (value): value is MoneyOptions => isRecord(value),
  render: (value, options, { intl }) => intl.format({ type: 'money', value, options }),
});

const second = defineEngine({
  kinds: [numberKind, pluralKind, moneyKind],
  presets: definePresets({
    money: { euro: { default: { currency: 'EUR' }, 'de-CH': { currency: 'CHF' } } },
    number: { tight: { default: { maximumFractionDigits: 0 } } },
  }),
  params: defineParams(['amount', 'items'] as const),
});

const total = second.dt('{items:plural}: {amount:money}', {
  plural: { items: { one: '{?} item', other: '{?} items', formatter: 'tight' } },
  money: { amount: { preset: 'euro', currencyDisplay: 'code' } },
});

expectTypeOf<ParamsOf<typeof total>>().toEqualTypeOf<{
  readonly items: number;
  readonly amount: number;
}>();

second.dt('{amount:money}', { money: { amount: 'euro' } });

// @ts-expect-error UnknownPreset: the second app's money presets hold no dollar
second.dt('{amount:money}', { money: { amount: 'dollar' } });

// @ts-expect-error UnknownOption: money takes MoneyOptions, not number options
second.dt('{amount:money}', { money: { amount: { notation: 'compact' } } });

// @ts-expect-error UnknownKind: the second app registers no enum
second.dt('{amount:enum}', { enum: { amount: {} } });

// @ts-expect-error UnknownParam: count is the first app's name, not the second's
second.dt('{count:number}');

// @ts-expect-error UnknownKind: the first app's engine has no money
engine.dt('{price:money}');

// @ts-expect-error UnknownPreset: the first app's number presets are not the second's
second.dt('{amount:number}', { number: { amount: 'compact' } });

defineEngine({
  kinds: [numberKind],
  // @ts-expect-error a preset option of the wrong type for its kind
  presets: definePresets({ number: { tight: { default: { maximumFractionDigits: 'none' } } } }),
  params: defineParams(['amount'] as const),
});

defineEngine({
  kinds: [numberKind],
  // @ts-expect-error UnknownKind: presets for a kind the engine does not list
  presets: definePresets({ money: { euro: { default: { currency: 'EUR' } } } }),
  params: defineParams(['amount'] as const),
});
