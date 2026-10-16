import { type ClassValue, cnMerge, createTV } from 'tailwind-variants';

const twMergeConfig = {
  extend: {
    classGroups: { z: [{ z: ['overlay', 'modal', 'dropdown', 'toast', 'tooltip'] }] },
  },
};

/** `tv` from tailwind-variants, merging the z-index tokens of `design-system.css` too. */
export const tv = createTV({ twMergeConfig });

/** Joins classes, a caller's last, and drops the ones a later class overrides. */
export function cn(...classes: ClassValue[]): string | undefined {
  return cnMerge(...classes)({ twMergeConfig });
}
