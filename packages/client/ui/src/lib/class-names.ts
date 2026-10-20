import { Z_LAYERS } from '@vp/design-tokens';
import { type ClassValue, cnMerge, createTV } from 'tailwind-variants';

const twMergeConfig = {
  extend: {
    classGroups: { z: [{ z: [...Z_LAYERS] }] },
  },
};

/** `tv` from tailwind-variants, merging the scale's z layers too. */
export const tv = createTV({ twMergeConfig });

/** Joins classes, a caller's last, and drops the ones a later class overrides. */
export function cn(...classes: ClassValue[]): string | undefined {
  return cnMerge(...classes)({ twMergeConfig });
}
