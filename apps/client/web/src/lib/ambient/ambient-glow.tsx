import {
  createContext,
  type PropsWithChildren,
  type RefCallback,
  use,
  useEffect,
  useState,
} from 'react';

export type AmbientGlow = Readonly<{
  /** Up to three CSS colours, start to end. */
  colors: readonly string[];
  /** The element the glow is sized from. */
  stage: HTMLElement;
}>;

type AmbientStore = Readonly<{
  glow: AmbientGlow | undefined;
  setGlow: (glow: AmbientGlow | undefined) => void;
}>;

const AmbientStoreContext = createContext<AmbientStore | undefined>(undefined);

/** Holds the glow a page asks the shell to draw behind everything: the page names the stage and the colours, the shell draws. */
export function AmbientGlowProvider({ children }: PropsWithChildren) {
  const [glow, setGlow] = useState<AmbientGlow>();

  return <AmbientStoreContext value={{ glow, setGlow }}>{children}</AmbientStoreContext>;
}

export function useAmbientGlowState(): AmbientStore {
  const store = use(AmbientStoreContext);
  if (store === undefined) {
    throw new Error('useAmbientGlowState must be used within AmbientGlowProvider');
  }
  return store;
}

/**
 * Asks the shell to draw a glow of `colors` behind the page, sized from the element the returned ref goes
 * on; it is gone when the page is. Without a provider (a page rendered alone) nothing is drawn.
 */
export function useAmbientGlow(colors: readonly string[]): RefCallback<HTMLElement> {
  const store = use(AmbientStoreContext);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const setGlow = store?.setGlow;
  const key = colors.join('|');

  useEffect(() => {
    if (setGlow === undefined || stage === null || key === '') {
      return;
    }

    setGlow({ colors: key.split('|'), stage });
    const clear = () => setGlow(undefined);
    return clear;
  }, [setGlow, stage, key]);

  return setStage;
}
