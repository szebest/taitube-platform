type Characters<S extends string> = S extends `${infer Head}${infer Rest}`
  ? Head | Characters<Rest>
  : never;

type Lower = Characters<'abcdefghijklmnopqrstuvwxyz'>;

type Letter = Lower | Uppercase<Lower>;

type LettersOnly<S extends string> = S extends ''
  ? true
  : S extends `${infer Head}${infer Rest}`
    ? Head extends Letter
      ? LettersOnly<Rest>
      : false
    : false;

/** Lower camelCase letters only: `{0}`, `{count2}`, `{Name}` and `{a_b}` are not names. */
export type IsCamelCase<S extends string> = S extends `${infer Head}${infer Rest}`
  ? Head extends Lower
    ? LettersOnly<Rest>
    : false
  : false;

export type InvalidParamName<Name extends string> = `InvalidParamName<'${Name}'>`;

type ValidNames<Names extends readonly string[]> = {
  readonly [I in keyof Names]: IsCamelCase<Names[I]> extends true
    ? Names[I]
    : InvalidParamName<Names[I]>;
};

/**
 * The closed vocabulary of placeholder names an app allows. A template naming anything else fails
 * with `UnknownParam`, so `count` cannot drift into `total` or `n` without a reviewed line here.
 */
export function defineParams<const Names extends readonly string[]>(
  names: Names & ValidNames<Names>
): Names {
  return Object.freeze(names);
}
