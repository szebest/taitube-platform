import { act, renderHook } from '@testing-library/react';
import { AppearanceProvider, DEFAULT_APPEARANCE, useAppearance } from '@vp/ui';
import { ThemeColorMeta } from '../theme-color-meta';

const query = (media: string): MediaQueryList => ({
  media,
  matches: false,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

function renderMeta(mode: 'system' | 'dark' | 'light') {
  vi.spyOn(window, 'matchMedia').mockImplementation(query);
  return renderHook(() => useAppearance(), {
    wrapper: ({ children }) => (
      <AppearanceProvider
        stored={{ preference: { ...DEFAULT_APPEARANCE, mode }, source: 'appearance' }}
      >
        {children}
        <ThemeColorMeta />
      </AppearanceProvider>
    ),
  });
}

const tags = () =>
  [...document.head.querySelectorAll('meta[name="theme-color"]')].map((tag) => [
    tag.getAttribute('media'),
    tag.getAttribute('content'),
  ]);

describe('apps/client/web: ThemeColorMeta', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      mode: 'system' as const,
      expected: [
        ['(prefers-color-scheme: dark)', '#14120F'],
        ['(prefers-color-scheme: light)', '#F6F2EB'],
      ],
    },
    { mode: 'light' as const, expected: [[null, '#F6F2EB']] },
  ])('puts $expected in the head in $mode mode', ({ mode, expected }) => {
    renderMeta(mode);

    expect(tags()).toEqual(expected);
  });

  it('follows a theme switch', () => {
    const { result } = renderMeta('dark');

    act(() => result.current.update({ theme: 'nocturne' }));

    expect(tags()).toEqual([[null, '#0B0E14']]);
  });
});
