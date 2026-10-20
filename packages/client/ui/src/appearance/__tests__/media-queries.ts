type Media = { scheme: 'dark' | 'light'; reducedMotion: boolean };

/** What the colour scheme and reduced motion queries answer in a jsdom spec, and a way to flip them. */
export function stubMediaQueries(initial: Partial<Media> = {}): {
  change: (next: Partial<Media>) => void;
} {
  let media: Media = { scheme: 'dark', reducedMotion: false, ...initial };
  const changes = new EventTarget();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string): MediaQueryList => ({
      media: query,
      matches:
        query === `(prefers-color-scheme: ${media.scheme})` ||
        (query === '(prefers-reduced-motion: reduce)' && media.reducedMotion),
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: changes.addEventListener.bind(changes),
      removeEventListener: changes.removeEventListener.bind(changes),
      dispatchEvent: changes.dispatchEvent.bind(changes),
    })
  );

  return {
    change: (next) => {
      media = { ...media, ...next };
      changes.dispatchEvent(new Event('change'));
    },
  };
}
