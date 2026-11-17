import { err, type Result } from '@kit/result';
import { type FormatFailure, type IntlBinding, unrenderable, wrongKind } from '@vp/intl';

export type Rendered = Result<string, FormatFailure>;

/** Whether a message using the kind must configure each of its names (`plural`, `enum`) or may (`number`). */
export type Requirement = 'required' | 'optional';

declare const entrySlot: unique symbol;

/**
 * In a kind's options, a field that takes an entry of another kind, presets included: a plural's
 * `formatter` is `EntryOf<'number'>`, so it accepts number options or a number preset name.
 */
export interface EntryOf<Kind extends string> {
  readonly [entrySlot]: Kind;
}

declare const configKey: unique symbol;

/** An argument that is one of the keys its message's config entry declares, as an enum's labels. */
export type ConfigKey = string & { readonly [configKey]: true };

export const isConfigKey = (value: unknown): value is ConfigKey => typeof value === 'string';

/** What a kind's `render` may use besides its value and options. */
export interface KindContext {
  readonly intl: IntlBinding;
  /** Renders `value` as the named kind would, resolving `entry` (options or a preset) the same way. */
  render(kind: string, value: unknown, entry: unknown): Rendered;
}

interface KindDefinition<Name extends string, Need extends Requirement, Arg, Options> {
  readonly name: Name;
  readonly config: Need;
  readonly arg: (value: unknown) => value is Arg;
  readonly options: (value: unknown) => value is Options;
  readonly render: (value: Arg, options: Options | undefined, context: KindContext) => Rendered;
}

export interface Kind<
  Name extends string = string,
  Need extends Requirement = Requirement,
  Arg = unknown,
  Options = unknown,
> {
  readonly name: Name;
  readonly config: Need;
  readonly format: (
    token: string,
    value: unknown,
    entry: unknown,
    context: KindContext
  ) => Rendered;
  readonly types?: { readonly arg: Arg; readonly options: Options };
}

/** How a declined argument is named in a `WrongKind` failure. */
export function describeValue(value: unknown): string {
  return Array.isArray(value) ? 'array' : typeof value;
}

/**
 * A placeholder kind: `{price:money}` once an engine lists a kind named `money`. `arg` and `options`
 * are the guards a value and a config entry pass at run time; their types are what a message's
 * argument and config entry take at compile time.
 */
export function defineKind<const Name extends string, const Need extends Requirement, Arg, Options>(
  definition: KindDefinition<Name, Need, Arg, Options>
): Kind<Name, Need, Arg, Options> {
  const { name, config, arg, options, render } = definition;
  return Object.freeze({
    name,
    config,
    format: (token: string, value: unknown, entry: unknown, context: KindContext): Rendered => {
      if (!arg(value)) return err(wrongKind(token, describeValue(value)));
      if (entry === undefined) return render(value, undefined, context);
      return options(entry)
        ? render(value, entry, context)
        : err(unrenderable(token, 'config entry of the wrong shape'));
    },
  });
}

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
