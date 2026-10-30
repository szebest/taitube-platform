import { defineTokenSet } from '@vp/design-tokens';
import type { appearance } from '@vp/ui/appearance/registry';

type Registry = typeof appearance;

export const EXTRA_THEME = 'dune';

export const EXTRA_SET = { group: 'radius', id: 'pill' } as const;

/** The real registry with one theme and one radius set more, which no page here names. */
export function extendRegistry<Module extends { appearance: Registry }>(original: Module): Module {
  const { appearance: registry } = original;
  const pill = defineTokenSet(EXTRA_SET.group, EXTRA_SET.id, registry.offer.radius[0].values);
  const dune = { ...registry.defaultTheme, id: EXTRA_THEME, name: 'Dune' };

  return {
    ...original,
    appearance: {
      ...registry,
      themes: [...registry.themes, dune],
      offer: { ...registry.offer, radius: [...registry.offer.radius, pill] },
    },
  } as Module;
}
