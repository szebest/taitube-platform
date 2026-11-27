import type { ConfigKey, EntryOf, Kind } from './kind';
import type { InvalidParamName, IsCamelCase } from './params';
import type { PresetTable } from './presets';
import type { Placeholder } from './template';

/** What an engine was defined with, as types: its kinds by name, its presets, its param names. */
export interface EngineTypes {
  readonly kinds: { readonly [name: string]: Kind };
  readonly presets: PresetTable;
  readonly params: string;
}

type KindsByName<Kinds extends readonly Kind[]> = {
  readonly [K in Kinds[number] as K['name']]: K;
};

/** The types of the engine `defineEngine` builds from these kinds, presets and param names. */
export interface EngineOf<
  Kinds extends readonly Kind[],
  Presets extends PresetTable,
  Params extends readonly string[],
> {
  readonly kinds: KindsByName<Kinds>;
  readonly presets: Presets;
  readonly params: Params[number];
}

export type DuplicateParam<Name extends string> = `DuplicateParam<'${Name}'>`;
export type UnknownParam<Name extends string> = `UnknownParam<'${Name}'>`;
export type ClashingKinds<Name extends string> = `ClashingKinds<'${Name}'>`;
export type UnknownKind<Name extends string> = `UnknownKind<'${Name}'>`;
export type UnknownPreset<Name extends string> = `UnknownPreset<'${Name}'>`;
export type UnknownOption<Name extends string> = `UnknownOption<'${Name}'>`;

/** A config value that fails a check: assignable to nothing, it names the error at the value's position. */
export interface Fails<Error extends string> {
  readonly typeError: Error;
}

export type MissingConfig<Template extends string> = `MissingConfig<'${Template}'>`;
export type PlaceholderInBranch<Token extends string> = `PlaceholderInBranch<'${Token}'>`;

type KindAt<E extends EngineTypes, K> = K extends keyof E['kinds'] ? E['kinds'][K] : never;
type ArgOfKind<Kd extends Kind> = NonNullable<Kd['types']>['arg'];
type OptionsOfKind<Kd extends Kind> = NonNullable<Kd['types']>['options'];
type PresetNames<E extends EngineTypes, K> = K extends keyof E['presets']
  ? keyof E['presets'][K] & string
  : never;

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type CheckName<H extends Placeholder, E extends EngineTypes, Seen extends Placeholder> =
  IsCamelCase<H['name']> extends false
    ? InvalidParamName<H['name']>
    : H['name'] extends E['params']
      ? H['kind'] extends undefined | (keyof E['kinds'] & string)
        ? [Extract<Seen, { readonly name: H['name'] }>] extends [never]
          ? true
          : Same<Extract<Seen, { readonly name: H['name'] }>['kind'], H['kind']> extends true
            ? DuplicateParam<H['name']>
            : ClashingKinds<H['name']>
        : UnknownKind<H['kind'] & string>
      : UnknownParam<H['name']>;

type CheckPlaceholders<
  P extends readonly Placeholder[],
  E extends EngineTypes,
  Seen extends Placeholder = never,
> = P extends readonly [infer H extends Placeholder, ...infer Rest extends readonly Placeholder[]]
  ? CheckName<H, E, Seen> extends true
    ? CheckPlaceholders<Rest, E, Seen | H>
    : CheckName<H, E, Seen>
  : true;

/** `T` when every placeholder is valid for the engine, else the first error, by name. */
export type ValidTemplate<
  T extends string,
  P extends readonly Placeholder[],
  E extends EngineTypes,
> = CheckPlaceholders<P, E> extends true ? T : CheckPlaceholders<P, E> & string;

type Typed<P extends readonly Placeholder[]> = Extract<P[number], { readonly kind: string }>;
type KindsIn<P extends readonly Placeholder[]> = Typed<P>['kind'];
type NamesOf<P extends readonly Placeholder[], K> = Extract<
  P[number],
  { readonly kind: K }
>['name'];

type Resolve<T, E extends EngineTypes> =
  T extends EntryOf<infer K>
    ? EntryFor<E, K>
    : T extends object
      ? { readonly [F in keyof T]: Resolve<T[F], E> }
      : T;

/**
 * What one placeholder of kind `K` may be configured with: options, a preset name, or a preset with
 * overrides. A name is any string here, so that `CheckConfig` can name the unknown one.
 */
type EntryFor<E extends EngineTypes, K> = [PresetNames<E, K>] extends [never]
  ? Resolve<OptionsOfKind<KindAt<E, K>>, E>
  :
      | Resolve<OptionsOfKind<KindAt<E, K>>, E>
      | string
      | ({ readonly preset: string } & Partial<Resolve<OptionsOfKind<KindAt<E, K>>, E>>);

type RequiredKinds<P extends readonly Placeholder[], E extends EngineTypes> = {
  [K in KindsIn<P>]: [KindAt<E, K>] extends [never]
    ? never
    : KindAt<E, K>['config'] extends 'required'
      ? K
      : never;
}[KindsIn<P>];

type Flatten<T> = { [K in keyof T]: T[K] };

/** The config a template needs: one entry per kind it uses, keyed by exactly that kind's names. */
export type ConfigFor<P extends readonly Placeholder[], E extends EngineTypes> = Flatten<
  {
    readonly [K in RequiredKinds<P, E>]: { readonly [N in NamesOf<P, K>]: EntryFor<E, K> };
  } & {
    readonly [K in Exclude<KindsIn<P>, RequiredKinds<P, E>>]?: {
      readonly [N in NamesOf<P, K>]?: EntryFor<E, K>;
    };
  }
>;

export type NeedsConfig<P extends readonly Placeholder[], E extends EngineTypes> = [
  RequiredKinds<P, E>,
] extends [never]
  ? false
  : true;

type AllKeys<T> = T extends unknown ? keyof T : never;
type FieldOf<T, F> = T extends unknown ? (F extends keyof T ? T[F] : never) : never;

type CheckBranch<
  S extends string,
  Whole extends string = S,
> = S extends `${string}{${infer Token}}${infer Rest}`
  ? Token extends '?'
    ? CheckBranch<Rest, Whole>
    : Fails<PlaceholderInBranch<Token>>
  : Whole;

type CheckField<V, Slot, E extends EngineTypes> =
  NonNullable<Slot> extends EntryOf<infer K>
    ? CheckEntry<V, E, K>
    : V extends string
      ? CheckBranch<V>
      : V;

type CheckOptions<A, O, E extends EngineTypes, Allowed> = {
  readonly [F in keyof A]: F extends Allowed
    ? A[F]
    : F extends AllKeys<O>
      ? CheckField<A[F], FieldOf<O, F>, E>
      : Fails<UnknownOption<F & string>>;
};

type CheckEntry<A, E extends EngineTypes, K> = A extends string
  ? A extends PresetNames<E, K>
    ? A
    : Fails<UnknownPreset<A>>
  : A extends { readonly preset: infer Name extends string }
    ? Name extends PresetNames<E, K>
      ? CheckOptions<A, OptionsOfKind<KindAt<E, K>>, E, 'preset'>
      : { readonly [F in keyof A]: F extends 'preset' ? Fails<UnknownPreset<Name>> : A[F] }
    : CheckOptions<A, OptionsOfKind<KindAt<E, K>>, E, never>;

/** `C` itself when it holds only the template's kinds and names, known presets and branch-safe text. */
export type CheckConfig<C, P extends readonly Placeholder[], E extends EngineTypes> = {
  readonly [K in keyof C]: K extends KindsIn<P>
    ? {
        readonly [N in keyof C[K]]: N extends NamesOf<P, K>
          ? CheckEntry<C[K][N], E, K>
          : Fails<UnknownParam<N & string>>;
      }
    : Fails<UnknownKind<K & string>>;
};

type EntryIn<C, K, N> = K extends keyof C ? (N extends keyof C[K] ? C[K][N] : never) : never;

type ArgFor<H extends Placeholder, C, E extends EngineTypes> = H['kind'] extends string
  ? [ArgOfKind<KindAt<E, H['kind']>>] extends [ConfigKey]
    ? keyof EntryIn<C, H['kind'], H['name']> & string
    : ArgOfKind<KindAt<E, H['kind']>>
  : string | number;

/** The argument object a template asks for, one field per placeholder name, typed by its kind. */
export type ArgsFor<P extends readonly Placeholder[], C, E extends EngineTypes> = {
  readonly [H in P[number] as H['name']]: ArgFor<H, C, E>;
};

/** Presets whose options each fit their kind's, for kinds the engine lists. */
export type PresetsFor<Presets, Kinds extends readonly Kind[]> = {
  readonly [K in keyof Presets]: K extends Kinds[number]['name']
    ? {
        readonly [N in keyof Presets[K]]: {
          readonly [L in keyof Presets[K][N]]: OptionsOfKind<
            Extract<Kinds[number], { readonly name: K }>
          >;
        };
      }
    : Fails<UnknownKind<K & string>>;
};
