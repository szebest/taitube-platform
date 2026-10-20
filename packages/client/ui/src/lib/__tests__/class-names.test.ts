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
      : [{ namespace, utility: `tw:${UTILITIES[namespace]}-${name}` }];
  }
);

describe('@vp/ui: class names', () => {
  it('lets a caller raise a primitive onto another z-index token', () => {
    expect(cn('tw:fixed tw:z-popover', 'tw:z-tooltip')).toBe('tw:fixed tw:z-tooltip');
  });

  it('merges the z-index tokens in a variant component too', () => {
    const panel = tv({ base: 'tw:z-popover tw:p-1' });

    expect(panel({ className: 'tw:z-toast' })).toBe('tw:p-1 tw:z-toast');
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
    ['a type style and a colour', 'tw:text-label tw:text-fg'],
    ['a border width and a border colour', 'tw:border-control tw:border-border-strong'],
    ['an outline width and an outline colour', 'tw:outline-focus tw:outline-focus-ring'],
  ])('keeps %s, which do not conflict', (_, classes) => {
    expect(cn(classes)).toBe(classes);
  });
});
