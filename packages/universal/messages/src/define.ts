import type { DateOptions, ListOptions, NumberOptions } from '@vp/intl';

/** The branches a count selects between; `{?}` in a branch is the count, formatted. */
export interface PluralBranches {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
  readonly formatter?: NumberOptions;
  readonly type?: Intl.PluralRuleType;
}

/** Per placeholder name, how its token type renders. */
export interface MessageConfig {
  readonly number?: Readonly<Record<string, NumberOptions>>;
  readonly date?: Readonly<Record<string, DateOptions>>;
  readonly list?: Readonly<Record<string, ListOptions>>;
  readonly plural?: Readonly<Record<string, PluralBranches>>;
  readonly enum?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface Message<T extends string = string, C extends MessageConfig = MessageConfig> {
  readonly template: T;
  readonly config: C;
}

type EnumKeys<C, Name extends string> = C extends { readonly enum: infer Enums }
  ? Name extends keyof Enums
    ? keyof Enums[Name] & string
    : never
  : never;

type ArgFor<Kind extends string, Name extends string, C> = Kind extends 'number' | 'plural'
  ? number
  : Kind extends 'date'
    ? string
    : Kind extends 'list'
      ? readonly string[]
      : Kind extends 'enum'
        ? EnumKeys<C, Name>
        : never;

type ParamsOf<T extends string, C> = T extends `${string}{${infer Token}}${infer Rest}`
  ? (Token extends `${infer Name}:${infer Kind}`
      ? { readonly [K in Name]: ArgFor<Kind, Name, C> }
      : { readonly [K in Token]: string | number }) &
      ParamsOf<Rest, C>
  : unknown;

type Flatten<T> = { [K in keyof T]: T[K] };

/** The argument object a template asks for: names and types read off `{name:type}` tokens. */
export type Params<T extends string, C = Record<never, never>> = Flatten<ParamsOf<T, C>>;

export function dt<const T extends string>(template: T): Message<T, Record<never, never>>;
export function dt<const T extends string, const C extends MessageConfig>(
  template: T,
  config: C
): Message<T, C>;
export function dt(template: string, config: MessageConfig = {}): Message {
  return { template, config };
}
