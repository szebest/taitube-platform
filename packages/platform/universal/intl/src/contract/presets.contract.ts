import { createRegistry, provide } from '@kit/di';
import { FormatErrorCodes } from '../failures';
import {
  definePresets,
  FormatPresets,
  type Preset,
  type PresetTable,
  resolveEntry,
} from '../presets';

/** @public */
export type MakePresets = () => PresetTable;

interface Entry {
  readonly kind: string;
  readonly name: string;
  readonly preset: Preset<unknown>;
}

const UNREGISTERED_LOCALE = 'contract-ZZ';
const MISSING_NAME = 'contract-missing';
const PROBE = { contractProbe: true };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const entriesOf = (table: PresetTable): readonly Entry[] =>
  Object.entries(table).flatMap(([kind, named]) =>
    Object.entries(named).map(([name, preset]) => ({ kind, name, preset }))
  );

const localesOf = ({ preset }: Entry): readonly string[] =>
  Object.keys(preset).filter((locale) => locale !== 'default');

/** @public */
export function describePresetsContract(makePresets: MakePresets): void {
  describe('FormatPresets contract', () => {
    let table: PresetTable;
    let entries: readonly Entry[];

    beforeEach(() => {
      table = makePresets();
      entries = entriesOf(table);
    });

    it('is frozen, so no caller edits the table after the app registered it', () => {
      expect(Object.isFrozen(table)).toBe(true);
    });

    it('gives every preset a default to end the locale chain on', () => {
      expect(entries.filter(({ preset }) => preset.default === undefined)).toEqual([]);
    });

    it('resolves a preset name to its default for a chain with no locale of its own', () => {
      expect(
        entries.map(({ kind, name }) => resolveEntry(table, kind, name, [UNREGISTERED_LOCALE]))
      ).toEqual(entries.map(({ preset }) => ({ ok: true, value: preset.default })));
    });

    it('resolves a preset name to the options of the first locale of the chain that has its own', () => {
      const own = entries.flatMap((entry) =>
        localesOf(entry).map((locale) => ({ ...entry, locale }))
      );

      expect(
        own.map(({ kind, name, locale }) =>
          resolveEntry(table, kind, name, [UNREGISTERED_LOCALE, locale])
        )
      ).toEqual(own.map(({ preset, locale }) => ({ ok: true, value: preset[locale] })));
    });

    it('lays the overrides of an entry over the options of the preset it names', () => {
      const records = entries.filter(({ preset }) => isRecord(preset.default));

      expect(
        records.map(({ kind, name }) => resolveEntry(table, kind, { preset: name, ...PROBE }, []))
      ).toEqual(
        records.map(({ preset }) => ({
          ok: true,
          value: { ...(isRecord(preset.default) ? preset.default : {}), ...PROBE },
        }))
      );
    });

    it('declines a name the kind has no preset for, with the unrenderable code', () => {
      expect(resolveEntry(table, 'number', MISSING_NAME, [])).toMatchObject({
        ok: false,
        error: { code: FormatErrorCodes.FORMAT_UNRENDERABLE },
      });
    });

    it('passes inline options through as written', () => {
      expect(resolveEntry(table, 'number', PROBE, [])).toEqual({ ok: true, value: PROBE });
    });

    it('resolves the table an app provided under FormatPresets, and a swapped one in its place', () => {
      const swapped = definePresets({ number: { swapped: { default: { useGrouping: false } } } });
      const registry = createRegistry().provide(provide(FormatPresets, table));

      expect(registry.get(FormatPresets)).toEqual({ ok: true, value: table });
      expect(registry.provide(provide(FormatPresets, swapped)).get(FormatPresets)).toEqual({
        ok: true,
        value: swapped,
      });
    });
  });
}
