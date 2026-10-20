import { prePaintScript } from '../pre-paint';
import { stubMediaQueries } from './media-queries';

const runBeforePaint = (followsSystem: boolean) => {
  const root = document.documentElement;
  root.dataset.mode = 'dark';
  root.dataset.motion = 'standard';
  new Function(prePaintScript(followsSystem))();
  return { mode: root.dataset.mode, motion: root.dataset.motion };
};

describe('@vp/ui: the pre-paint script', () => {
  it.each([
    {
      label: 'a system mode on a light OS',
      followsSystem: true,
      scheme: 'light',
      reducedMotion: false,
      shown: { mode: 'light', motion: 'standard' },
    },
    {
      label: 'a chosen mode on a light OS',
      followsSystem: false,
      scheme: 'light',
      reducedMotion: false,
      shown: { mode: 'dark', motion: 'standard' },
    },
    {
      label: 'a viewer asking for reduced motion',
      followsSystem: false,
      scheme: 'dark',
      reducedMotion: true,
      shown: { mode: 'dark', motion: 'reduced' },
    },
  ] as const)('settles $label before paint', ({ followsSystem, scheme, reducedMotion, shown }) => {
    stubMediaQueries({ scheme, reducedMotion });

    expect(runBeforePaint(followsSystem)).toEqual(shown);
  });
});
