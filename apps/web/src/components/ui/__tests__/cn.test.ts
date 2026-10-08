import { cn } from '../cn';

describe('apps/web: cn', () => {
  it.each([
    { classes: ['tw:px-4 tw:text-sm', 'tw:px-2'], merged: 'tw:text-sm tw:px-2' },
    { classes: ['tw:text-fg', 'tw:text-sm'], merged: 'tw:text-fg tw:text-sm' },
    { classes: ['tw:bg-surface', undefined, false as const, 'tw:bg-accent'], merged: 'tw:bg-accent' },
    {
      classes: ['tw:focus-ring legacy-class', 'tw:h-9'],
      merged: 'tw:focus-ring legacy-class tw:h-9',
    },
  ])(
    'merges $classes into "$merged", the later class winning a conflict',
    ({ classes, merged }) => {
      expect(cn(...classes)).toBe(merged);
    }
  );
});
