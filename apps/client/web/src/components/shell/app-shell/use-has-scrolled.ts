import { useEffect, useState } from 'react';

export function useHasScrolled() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    const stopListening = () => window.removeEventListener('scroll', update);
    return stopListening;
  }, []);

  return scrolled;
}
