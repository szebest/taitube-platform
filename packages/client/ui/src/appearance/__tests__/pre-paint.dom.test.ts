import { prePaintScript } from '../pre-paint';
import { stubMediaQueries } from './media-queries';

const runBeforePaint = (followsSystem: boolean, followsContrast: boolean) => {
  const root = document.documentElement;
  root.dataset.mode = 'dark';
  root.dataset.motion = 'standard';
  root.dataset.contrast = 'standard';
  new Function(prePaintScript(followsSystem, followsContrast))();
  return { mode: root.dataset.mode, motion: root.dataset.motion, contrast: root.dataset.contrast };
};

const OS = { scheme: 'dark', reducedMotion: false, moreContrast: false } as const;
const STANDARD = { mode: 'dark', motion: 'standard', contrast: 'standard' } as const;

describe('@vp/ui: the pre-paint script', () => {
  it.each([
    {
      label: 'a system mode on a light OS',
      followsSystem: true,
      followsContrast: false,
      os: { ...OS, scheme: 'light' },
      shown: { ...STANDARD, mode: 'light' },
    },
    {
      label: 'a chosen mode on a light OS',
      followsSystem: false,
      followsContrast: false,
      os: { ...OS, scheme: 'light' },
      shown: STANDARD,
    },
    {
      label: 'a viewer asking for reduced motion',
      followsSystem: false,
      followsContrast: false,
      os: { ...OS, reducedMotion: true },
      shown: { ...STANDARD, motion: 'reduced' },
    },
    {
      label: 'an auto contrast on a system asking for more',
      followsSystem: false,
      followsContrast: true,
      os: { ...OS, moreContrast: true },
      shown: { ...STANDARD, contrast: 'more' },
    },
    {
      label: 'a chosen contrast on a system asking for more',
      followsSystem: false,
      followsContrast: false,
      os: { ...OS, moreContrast: true },
      shown: STANDARD,
    },
  ] as const)('settles $label before paint', ({ followsSystem, followsContrast, os, shown }) => {
    stubMediaQueries(os);

    expect(runBeforePaint(followsSystem, followsContrast)).toEqual(shown);
  });
});
