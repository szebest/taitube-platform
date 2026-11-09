import { prefersReducedMotion, scrollToEnd } from '../live-chat-scroll';

const mockMatchMedia = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches }))
  );

describe('apps/client/web: live-chat scroll', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.motion;
  });

  it.each([
    { motion: 'reduced', media: false, reduced: true },
    { motion: undefined, media: true, reduced: true },
    { motion: undefined, media: false, reduced: false },
  ])('is $reduced for motion $motion and media $media', ({ motion, media, reduced }) => {
    mockMatchMedia(media);
    if (motion) document.documentElement.dataset.motion = motion;

    expect(prefersReducedMotion()).toBe(reduced);
  });

  it('scrolls to the end with the behaviour, or sets scrollTop without scrollTo', () => {
    const withScrollTo = { scrollHeight: 500, scrollTo: vi.fn() };
    const without = { scrollHeight: 500, scrollTop: 0 };

    scrollToEnd(withScrollTo as unknown as HTMLElement, 'smooth');
    scrollToEnd(without as unknown as HTMLElement, 'auto');

    expect(withScrollTo.scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
    expect(without.scrollTop).toBe(500);
  });
});
