import { type Result, andThen, map, ok } from '@kit/result';
import type { FormatFailure } from './failures';
import { finite, isNumber } from './inputs';
import { type KindContext, defineKind, optionKeys } from './kind';

/**
 * What a number kind hands `Intl.NumberFormat`: the amount, and the options to format it with.
 * @public
 */
export interface NumberInput {
  readonly amount: number | Intl.StringNumericLiteral;
  readonly format: Intl.NumberFormatOptions;
}

interface NumberKindDefinition<Name extends string, Options extends object> {
  readonly name: Name;
  readonly keys: readonly (keyof Options & string)[];
  readonly defaults?: Intl.NumberFormatOptions;
  readonly transform: (
    value: number,
    options: Partial<Options>,
    context: KindContext
  ) => Result<NumberInput, FormatFailure>;
}

/**
 * The defaults a caller's options leave room for: a default is dropped once the caller names
 * either side of its pair, so `{ minimumFractionDigits: 2 }` never meets a default maximum of 1.
 * @internal
 */
export function defaultsFor(
  defaults: Intl.NumberFormatOptions,
  options: Intl.NumberFormatOptions
): Intl.NumberFormatOptions {
  const {
    minimumFractionDigits,
    maximumFractionDigits,
    minimumSignificantDigits,
    maximumSignificantDigits,
    ...unpaired
  } = defaults;
  const fractionTaken =
    options.minimumFractionDigits !== undefined || options.maximumFractionDigits !== undefined;
  const significantTaken =
    options.minimumSignificantDigits !== undefined ||
    options.maximumSignificantDigits !== undefined;
  return {
    ...unpaired,
    ...(fractionTaken ? {} : { minimumFractionDigits, maximumFractionDigits }),
    ...(significantTaken ? {} : { minimumSignificantDigits, maximumSignificantDigits }),
  };
}

/** A kind over `Intl.NumberFormat`: a finite number in, `transform` deciding what is formatted how. */
export function defineNumberKind<const Name extends string, Options extends object>({
  name,
  keys,
  defaults = {},
  transform,
}: NumberKindDefinition<Name, Options>) {
  const check = optionKeys<Options>(keys);
  const inputFrom = (
    value: number,
    options: Options | undefined,
    context: KindContext
  ): Result<NumberInput, FormatFailure> =>
    andThen(finite(name, value), (finiteValue) =>
      andThen(transform(finiteValue, options ?? {}, context), ({ amount, format }) =>
        ok({ amount, format: { ...defaultsFor(defaults, format), ...format } })
      )
    );
  const kind = defineKind({
    name,
    arg: isNumber,
    options: check,
    render: (value, options, context) =>
      andThen(inputFrom(value, options, context), ({ amount, format }) =>
        map(context.cache.numberFormat(context.locale, format), (formatter) =>
          formatter.format(amount)
        )
      ),
  });
  return Object.freeze({
    ...kind,
    /** What this kind hands `Intl.NumberFormat` for a value and unchecked options, for a kind that composes it. */
    input: (value: number, options: unknown, context: KindContext) =>
      options === undefined
        ? inputFrom(value, undefined, context)
        : andThen(check(options, name), (valid) => inputFrom(value, valid, context)),
  });
}

export interface Scaled<U extends string> {
  readonly amount: number;
  readonly unit: U;
}

/**
 * Divides by `step` until the amount fits the largest unit it reaches, the last unit capping it
 * and `first` the one it never goes below.
 * @internal
 */
export function scale<U extends string>(
  value: number,
  step: number,
  units: readonly [U, ...U[]],
  first = 0
): Scaled<U> {
  let amount = value / step ** first;
  let index = first;
  while (Math.abs(amount) >= step && index < units.length - 1) {
    amount /= step;
    index += 1;
  }
  return { amount, unit: units[index] ?? units[0] };
}

interface ScaledUnitKindDefinition<
  Name extends string,
  Options extends { readonly minUnit?: Unit },
  Unit extends string,
> {
  readonly name: Name;
  readonly keys: readonly (keyof Options & string)[];
  readonly units: readonly [Unit, ...Unit[]];
  /** The step between units for these options, and the options `Intl` is handed. */
  readonly scaleBy: (options: Omit<Partial<Options>, 'minUnit'>) => {
    readonly step: number;
    readonly display: Intl.NumberFormatOptions;
  };
}

/**
 * A quantity read in the largest unit it reaches (`4.5 MB`, `4.5 Mb/s`), one decimal unless the
 * caller says else; `minUnit` is the smallest unit it is shown in.
 */
export function defineScaledUnitKind<
  const Name extends string,
  Options extends { readonly minUnit?: Unit },
  const Unit extends string,
>({ name, keys, units, scaleBy }: ScaledUnitKindDefinition<Name, Options, Unit>) {
  return defineNumberKind<Name, Options>({
    name,
    keys,
    defaults: { maximumFractionDigits: 1 },
    transform: (value, { minUnit, ...options }) => {
      const { step, display } = scaleBy(options);
      const first = minUnit === undefined ? 0 : Math.max(units.indexOf(minUnit), 0);
      const { amount, unit } = scale(value, step, units, first);
      return ok({ amount, format: { ...display, style: 'unit', unit } });
    },
  });
}
