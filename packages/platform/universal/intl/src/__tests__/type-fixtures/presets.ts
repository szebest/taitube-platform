import { type Preset, type PresetTable, definePresets, resolveEntry } from '../../presets';

const presets = definePresets({
  number: { compact: { default: { notation: 'compact' }, pl: { maximumFractionDigits: 0 } } },
});

expectTypeOf(presets.number.compact.default).toEqualTypeOf<{ readonly notation: 'compact' }>();
expectTypeOf(presets).toExtend<PresetTable>();
expectTypeOf<Preset<number>>().toExtend<{ readonly default: number }>();
expectTypeOf<Preset<number>['pl-PL']>().toEqualTypeOf<number>();
expectTypeOf(resolveEntry).parameters.toEqualTypeOf<
  [PresetTable, string, unknown, readonly string[]]
>();

const _locale: Preset<number> = { default: 1, 'pl-PL': 2 };

// @ts-expect-error a preset always has its default options
const _noDefault: Preset<number> = { pl: 1 };

// @ts-expect-error a locale entry holds the same options type as default
const _wrongLocale: Preset<number> = { default: 1, pl: 'one' };

// @ts-expect-error a table holds kinds of presets, not bare option sets
definePresets({ number: { compact: { notation: 'compact' } } });

// @ts-expect-error a table nests kind, preset name, then the preset
definePresets({ number: { default: { notation: 'compact' } } });

expectTypeOf(presets.number).not.toHaveProperty('tight');

const _partialLocale: Preset<{ readonly a: number; readonly b: number }> = {
  default: { a: 1, b: 2 },
  pl: { b: 3 },
};

// @ts-expect-error a locale overrides an option of the preset's own kind, nothing else
const _foreignOverride: Preset<{ readonly a: number }> = { default: { a: 1 }, pl: { c: 3 } };
