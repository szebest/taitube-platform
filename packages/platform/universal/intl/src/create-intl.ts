import { type Result, andThen, err, ok } from '@kit/result';
import type { FormatContext } from './context';
import { type FormatFailure, wrongKind } from './failures';
import { type FormatKinds, type FormatValueOf, formatKinds } from './format-value';
import {
  type ArgOf,
  type FormatInput,
  type Kind,
  type KindContext,
  type OptionsOf,
  type OutOf,
  runKind,
} from './kind';

type Named<Kinds extends readonly Kind[], Name> = Extract<Kinds[number], { readonly name: Name }>;

/** Every kind of a registry bound to one context: what a provider hands its components. */
export interface IntlBinding<Kinds extends readonly Kind[] = FormatKinds> {
  readonly context: KindContext;
  format(value: FormatValueOf<Kinds>): Result<string, FormatFailure>;
  call<const Name extends Kinds[number]['name']>(
    name: Name,
    arg: ArgOf<Named<Kinds, Name>>,
    options?: OptionsOf<Named<Kinds, Name>>
  ): Result<OutOf<Named<Kinds, Name>>, FormatFailure>;
}

interface AnyBinding {
  readonly context: KindContext;
  format(value: FormatInput): Result<string, FormatFailure>;
  call(name: string, arg: unknown, options?: unknown): Result<unknown, FormatFailure>;
}

function bind(kinds: readonly Kind[], context: FormatContext) {
  const byName = new Map(kinds.map((kind) => [kind.name, kind]));

  const run = (name: string, arg: unknown, options: unknown): Result<unknown, FormatFailure> => {
    const kind = byName.get(name);
    return kind === undefined
      ? err(wrongKind('format', `${name}, a kind it does not register`))
      : runKind(kind, arg, options, kindContext);
  };

  const format = (value: FormatInput): Result<string, FormatFailure> => {
    if (typeof value === 'string') return ok(value);
    const tagged = typeof value === 'number' ? { type: 'number', value } : value;
    return andThen(run(tagged.type, tagged.value, tagged.options), (text) =>
      typeof text === 'string' ? ok(text) : err(wrongKind('format', `${tagged.type} as text`))
    );
  };

  const kindContext: KindContext = { ...context, format };
  return { kindContext, run, format };
}

export function createIntl(context: FormatContext): IntlBinding;
export function createIntl<const Kinds extends readonly Kind[]>(
  context: FormatContext,
  kinds: Kinds
): IntlBinding<Kinds>;
export function createIntl(
  context: FormatContext,
  kinds: readonly Kind[] = formatKinds
): AnyBinding {
  const { kindContext, run, format } = bind(kinds, context);
  return { context: kindContext, format, call: run };
}
