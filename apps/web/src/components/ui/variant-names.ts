/** The names a `tv()` variant offers, `buttonVariants.variants.size` for one, to list every look. */
export function variantNames<Variant extends Record<string, unknown>>(
  variant: Variant
): (keyof Variant & string)[] {
  return Object.keys(variant);
}
