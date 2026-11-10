import { DEFAULT_APPEARANCE } from '@vp/ui';
import { noteGuestChange } from '../guest-changes';

const NOCTURNE = { ...DEFAULT_APPEARANCE, theme: 'nocturne' };

describe('noteGuestChange', () => {
  it('measures the first preference from itself, so nothing is a change yet', () => {
    const baseline = { current: undefined };

    expect(noteGuestChange(baseline, NOCTURNE)).toEqual([]);
    expect(baseline.current).toBe(NOCTURNE);
  });

  it.each([
    { label: 'a theme', next: NOCTURNE, paths: ['appearance.theme'] },
    {
      label: 'an override',
      next: { ...DEFAULT_APPEARANCE, overrides: { radius: 'soft' } },
      paths: ['appearance.overrides.radius'],
    },
    { label: 'nothing', next: DEFAULT_APPEARANCE, paths: [] },
  ])('names $label as the path changed, and moves the baseline', ({ next, paths }) => {
    const baseline = { current: DEFAULT_APPEARANCE };

    expect(noteGuestChange(baseline, next)).toEqual(paths);
    expect(baseline.current).toBe(next);
  });

  it('does not count a preference the app put back itself, once the baseline was set to it', () => {
    const baseline = { current: NOCTURNE };

    expect(noteGuestChange(baseline, NOCTURNE)).toEqual([]);
  });
});
