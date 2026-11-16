import { tailwindUtilities } from '@vp/design-tokens';
import { appearance } from '../../appearance/registry';
import { scale } from '../../tokens/scale';
import { cn, tv } from '../class-names';

/** The utility each token namespace feeds, so a test can write two of them. */
const UTILITIES: Readonly<Record<string, string>> = {
  spacing: 'p',
  text: 'text',
  radius: 'rounded',
  shadow: 'shadow',
  'transition-duration': 'duration',
  'border-width': 'border',
  'outline-width': 'outline',
  'outline-offset': 'outline-offset',
};

const TOKEN_UTILITIES = tailwindUtilities(appearance.defaultTheme.defaults, scale).flatMap(
  ({ property }) => {
    const namespace = Object.keys(UTILITIES).find((key) => property.startsWith(`--${key}-`));
    const name = namespace === undefined ? '' : property.slice(namespace.length + 3);
    return namespace === undefined || name.includes('--')
      ? []
      : [{ namespace, utility: `${UTILITIES[namespace]}-${name}` }];
  }
);

describe('@vp/ui: class names', () => {
  it('lets a caller raise a primitive onto another z-index token', () => {
    expect(cn('fixed z-popover', 'z-tooltip')).toBe('fixed z-tooltip');
  });

  it('merges the z-index tokens in a variant component too', () => {
    const panel = tv({ base: 'z-popover p-1' });

    expect(panel({ className: 'z-toast' })).toBe('p-1 z-toast');
  });

  it.each(TOKEN_UTILITIES)(
    'lets a caller override $utility with a sibling token',
    ({ namespace, utility }) => {
      const sibling = TOKEN_UTILITIES.find(
        (other) => other.namespace === namespace && other.utility !== utility
      );

      expect(cn(sibling?.utility, utility)).toBe(utility);
    }
  );

  it.each([
    ['a type style and a colour', 'text-label text-fg'],
    ['a border width and a border colour', 'border-control border-border-strong'],
    ['an outline width and an outline colour', 'outline-focus outline-focus-ring'],
  ])('keeps %s, which do not conflict', (_, classes) => {
    expect(cn(classes)).toBe(classes);
  });
});
