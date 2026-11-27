import { type Result, andThen, err, ok } from '@kit/result';
import type { FormatContext } from './context';
import { type FormatFailure, unknownOption, unrenderable, wrongKind } from './failures';

/**
 * A tagged value as a kind composing another one writes it: the kind is looked up by `type`.
 * @public
 */
export interface AnyTaggedValue {
  readonly type: string;
  readonly value?: unknown;
  readonly options?: unknown;
}

/** What a kind may format through its context: text as authored, a bare number, or a tagged value. */
export type FormatInput = string | number | AnyTaggedValue;

/**
 * What a kind's `render` receives besides its argument and options. `format` renders another
 * kind by name, so a kind composes one it never imports.
 */
export interface KindContext extends FormatContext {
  format(value: FormatInput): Result<string, FormatFailure>;
}

/** Turns a config entry into the kind's options, or the failure naming what is wrong with it. */
export type CheckOptions<Options> = (
  value: unknown,
  kind: string
) => Result<Options, FormatFailure>;

/**
 * One formatter, built in or an app's own. `arg` guards the value, `options` checks the options
 * (`optionKeys` allowlists them), `render` turns both into `Out`: text for every kind a message
 * or `format` can show, something else (a comparator, a plural category) for the rest. `parts`
 * is the same result as structure a UI may use (a list's items and its "and 2 more").
 */
export interface Kind<
  Name extends string = string,
  Arg = unknown,
  Options = unknown,
  Out = unknown,
  Parts = unknown,
> {
  readonly name: Name;
  arg(value: unknown): value is Arg;
  options(value: unknown, kind: string): Result<Options, FormatFailure>;
  render(arg: Arg, options: Options | undefined, context: KindContext): Result<Out, FormatFailure>;
  parts?(
    arg: Arg,
    options: Options | undefined,
    context: KindContext
  ): Result<Parts, FormatFailure>;
}

export type ArgOf<K> = K extends Kind<string, infer Arg, unknown, unknown> ? Arg : never;
export type OptionsOf<K> =
  K extends Kind<string, unknown, infer Options, unknown> ? Options : never;
export type OutOf<K> = K extends Kind<string, unknown, unknown, infer Out> ? Out : never;

/** The tagged value a text kind formats; `options` is required once one of its options is. */
export type TaggedOf<K> =
  K extends Kind<infer Name, infer Arg, infer Options, infer Out>
    ? string extends Out
      ? { readonly type: Name; readonly value: Arg } & (Record<never, never> extends Options
          ? { readonly options?: Options }
          : { readonly options: Options })
      : never
    : never;

type Renders<Arg, Options, T> = (
  arg: Arg,
  options: Options | undefined,
  context: KindContext
) => Result<T, FormatFailure>;

interface KindDefinition<Name extends string, Arg, Options, Out, Parts> {
  readonly name: Name;
  readonly arg: (value: unknown) => value is Arg;
  readonly options: CheckOptions<Options>;
  readonly render: Renders<Arg, Options, Out>;
  readonly parts?: Renders<Arg, Options, Parts>;
}

export function defineKind<const Name extends string, Arg, Options, Out = string, Parts = never>(
  definition: KindDefinition<Name, Arg, Options, Out, Parts>
): Kind<Name, Arg, Options, Out, Parts> {
  return Object.freeze({ ...definition });
}

/** A formatter's allowed option names: the `Intl` constructor's own keys, plus any it adds. */
export type OptionKeys<Native, Ours extends string = never> = readonly (keyof Native | Ours)[];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Declines an option the kind does not name instead of letting `Intl` ignore it, so
 * `date(stlye: 'short')` fails with the misspelling rather than rendering a default.
 */
export function optionKeys<Options extends object>(
  allowed: readonly (keyof Options & string)[]
): CheckOptions<Options> {
  const isAllowed = (key: string) => allowed.some((name) => name === key);
  const isOptions = (value: object): value is Options => Object.keys(value).every(isAllowed);
  return (value, kind) => {
    if (!isRecord(value)) return err(unrenderable(kind, 'options are not an object'));
    if (isOptions(value)) return ok(value);
    const unknown = Object.keys(value).find((key) => !isAllowed(key)) ?? '';
    return err(unknownOption(kind, unknown));
  };
}

/** How a declined argument is named in a `WrongKind` failure. */
export function describeValue(value: unknown): string {
  return Array.isArray(value) ? 'array' : typeof value;
}

/**
 * Runs one kind on a value from anywhere (a message argument, a tagged value): the guard, then
 * the options check, then `render`. `label` names the caller in a declined argument or option.
 */
export function runKind<Arg, Options, Out>(
  kind: Kind<string, Arg, Options, Out>,
  arg: unknown,
  options: unknown,
  context: KindContext,
  label: string = kind.name
): Result<Out, FormatFailure> {
  return checked(kind, arg, options, label, (value, valid) => kind.render(value, valid, context));
}

/** `runKind` for a kind's structure: its `parts`, or a failure when it has none. */
export function runParts<Arg, Options, Parts>(
  kind: Kind<string, Arg, Options, unknown, Parts>,
  arg: unknown,
  options: unknown,
  context: KindContext,
  label: string = kind.name
): Result<Parts, FormatFailure> {
  const { parts } = kind;
  if (parts === undefined) return err(unrenderable(label, `${kind.name} has no parts`));
  return checked(kind, arg, options, label, (value, valid) => parts(value, valid, context));
}

function checked<Arg, Options, T>(
  kind: Kind<string, Arg, Options, unknown, unknown>,
  arg: unknown,
  options: unknown,
  label: string,
  run: (arg: Arg, options: Options | undefined) => Result<T, FormatFailure>
): Result<T, FormatFailure> {
  if (!kind.arg(arg)) return err(wrongKind(label, describeValue(arg)));
  if (options === undefined) return run(arg, undefined);
  return andThen(kind.options(options, label), (valid) => run(arg, valid));
}
