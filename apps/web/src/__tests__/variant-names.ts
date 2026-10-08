/** The names a `tv()` variant offers, `button.variants.size` for instance, to drive an `it.each`. */
export function variantNames<Variant extends Record<string, unknown>>(
  variant: Variant
): (keyof Variant & string)[] {
  return Object.keys(variant);
}
