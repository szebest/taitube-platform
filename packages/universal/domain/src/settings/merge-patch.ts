/**
 * A partial update of `T`: a key left out keeps the stored value and `null` resets it to its
 * default. A nested object patches key by key under the same rule.
 */
export type MergePatch<T> = {
  readonly [K in keyof T]?:
    | (NonNullable<T[K]> extends object ? MergePatch<NonNullable<T[K]>> : T[K])
    | null;
};
