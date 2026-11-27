import { err, ok, type Result } from '@kit/result';
import { type FormatFailure, unrenderable } from './failures';

/**
 * One named option set: `default`, and any locale (`pl`, `pl-PL`) that overrides some of it.
 * @public
 */
export type Preset<Options> = { readonly default: Options } & {
  readonly [locale: string]: Partial<Options>;
};

/** Per kind name, per preset name, the preset. */
export type PresetTable = Readonly<Record<string, Readonly<Record<string, Preset<unknown>>>>>;

/**
 * Named option sets, per kind: `definePresets({ number: { compact: { default: {...}, pl: {...} } } })`.
 * An app registers the table once; the message engine and a server render resolve it the same way.
 */
export function definePresets<const Presets extends PresetTable>(presets: Presets): Presets {
  return Object.freeze(presets);
}

type Resolved = Result<unknown, FormatFailure>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function presetOptions(
  presets: PresetTable,
  kind: string,
  name: string,
  chain: readonly string[]
): Resolved {
  const preset = presets[kind]?.[name];
  if (preset === undefined) return err(unrenderable(kind, `no preset ${name}`));
  const overrides = chain.toReversed().map((tag) => preset[tag]);
  return ok(overrides.reduce<unknown>(layer, preset.default));
}

function layer(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  return isRecord(base) && isRecord(override) ? { ...base, ...override } : override;
}

/**
 * A config entry as its kind receives it: a preset name becomes that preset's `default` with each
 * locale of the chain that overrides it laid over, most specific last; `{ preset, ...overrides }`
 * lays the overrides over them; anything else is inline options, passed as written.
 */
export function resolveEntry(
  presets: PresetTable,
  kind: string,
  entry: unknown,
  chain: readonly string[]
): Resolved {
  if (typeof entry === 'string') return presetOptions(presets, kind, entry, chain);
  if (!isRecord(entry)) return ok(entry);
  const { preset, ...overrides } = entry;
  if (typeof preset !== 'string') return ok(entry);
  const base = presetOptions(presets, kind, preset, chain);
  return base.ok && isRecord(base.value) ? ok({ ...base.value, ...overrides }) : base;
}
