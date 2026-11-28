import type { ParamsOf } from '../../message';
import { engine } from '../fixtures';

const { dt } = engine;

dt('{count:plural}', { plural: { count: { one: '{?} view', other: '{?} views' } } });
dt('{count:plural}', { plural: { count: { other: '{?}', formatter: 'compact' } } });
dt('{count:plural}', {
  plural: { count: { other: '{?}', formatter: { preset: 'compact', maximumFractionDigits: 1 } } },
});
dt('{price:number}');
dt('{price:number}', { number: { price: 'compact' } });
dt('{price:number}', { number: { price: { preset: 'whole', useGrouping: false } } });
dt('{price:number}', { number: { price: { maximumFractionDigits: 1 } } });

const state = dt('{state:enum}', { enum: { state: { ready: 'Ready', failed: 'Failed' } } });
expectTypeOf<ParamsOf<typeof state>>().toEqualTypeOf<{
  readonly state: 'ready' | 'failed';
}>();

// @ts-expect-error MissingConfig: a plural with no config
dt('{count:plural} views');

// @ts-expect-error MissingConfig: an enum with no labels
dt('{state:enum}');

// @ts-expect-error UnknownParam: a config name the template does not hold
dt('{count:plural}', { plural: { count: { other: '{?}' }, total: { other: '{?}' } } });

// @ts-expect-error a config that misses a name the template holds
dt('{count:plural}', { plural: { total: { other: '{?}' } } });

// @ts-expect-error UnknownKind: config for a kind the template does not use
dt('{count:plural}', { plural: { count: { other: '{?}' } }, number: { count: {} } });

// @ts-expect-error a plural needs other
dt('{count:plural}', { plural: { count: { one: '{?} view' } } });

// @ts-expect-error UnknownOption: a category CLDR does not have
dt('{count:plural}', { plural: { count: { several: '{?}', other: '{?}' } } });

// @ts-expect-error PlaceholderInBranch: only {?} renders inside a branch
dt('{count:plural}', { plural: { count: { other: '{?} by {name}' } } });

// @ts-expect-error UnknownPreset: a misspelt preset name
dt('{price:number}', { number: { price: 'compcat' } });

// @ts-expect-error UnknownPreset: a misspelt preset under overrides
dt('{price:number}', { number: { price: { preset: 'compcat', useGrouping: false } } });

// @ts-expect-error UnknownPreset: the count formatter of a plural names a number preset
dt('{count:plural}', { plural: { count: { other: '{?}', formatter: 'compcat' } } });

// @ts-expect-error UnknownOption: a date option on a number
dt('{price:number}', { number: { price: { dateStyle: 'long' } } });

// @ts-expect-error UnknownOption: overrides take only the kind's options
dt('{price:number}', { number: { price: { preset: 'compact', dateStyle: 'long' } } });

// @ts-expect-error an option of the wrong type
dt('{price:number}', { number: { price: { maximumFractionDigits: 'one' } } });

// @ts-expect-error UnknownPreset: date has no presets
dt('{when:date}', { date: { when: 'compact' } });

const prices = dt('From {names:list}', {
  list: { names: { item: { kind: 'money' }, max: 2, more: { other: '{?} more' } } },
});
expectTypeOf<ParamsOf<typeof prices>>().toEqualTypeOf<{ readonly names: readonly number[] }>();

// @ts-expect-error a collapsed list needs its more copy
dt('In {names:list}', { list: { names: { max: 2 } } });
