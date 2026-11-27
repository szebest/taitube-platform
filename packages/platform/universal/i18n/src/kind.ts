import type { Kind } from '@kit/intl';

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

/** A `@kit/intl` text kind a template may name, `{price:money}`, and whether its config is required. */
export type MessageKind<
  Name extends string = string,
  Need extends Requirement = Requirement,
  Arg = unknown,
  Options = unknown,
> = Kind<Name, Arg, Options, string> & { readonly config: Need };

/**
 * Makes a text kind a placeholder kind: `messageKind(money, 'optional')` once an engine lists it.
 * The kind is the formatter itself, so `{price:money}` and `format(money(...))` agree byte for byte.
 */
export function messageKind<
  const Need extends Requirement,
  const K extends Kind<string, unknown, unknown, string>,
>(kind: K, config: Need): K & { readonly config: Need } {
  return Object.freeze({ ...kind, config });
}

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
