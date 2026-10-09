import { cn, tv } from '../class-names';

describe('apps/client/web: class names', () => {
  it('lets a caller raise a primitive onto another z-index token', () => {
    expect(cn('tw:fixed tw:z-dropdown', 'tw:z-tooltip')).toBe('tw:fixed tw:z-tooltip');
  });

  it('merges the z-index tokens in a variant component too', () => {
    const panel = tv({ base: 'tw:z-dropdown tw:p-1' });

    expect(panel({ className: 'tw:z-toast' })).toBe('tw:p-1 tw:z-toast');
  });

  it('keeps a colour and a size of the same utility, which do not conflict', () => {
    expect(cn('tw:text-xs', 'tw:text-fg-muted')).toBe('tw:text-xs tw:text-fg-muted');
  });
});
