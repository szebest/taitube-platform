type ColorScheme = 'dark' | 'light';

/** What `prefers-color-scheme` answers in a jsdom spec, and a way to flip it as the OS would. */
export function stubColorScheme(initial: ColorScheme): { change: (next: ColorScheme) => void } {
  let scheme = initial;
  const changes = new EventTarget();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (media: string): MediaQueryList => ({
      media,
      matches: media === `(prefers-color-scheme: ${scheme})`,
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
      scheme = next;
      changes.dispatchEvent(new Event('change'));
    },
  };
}
