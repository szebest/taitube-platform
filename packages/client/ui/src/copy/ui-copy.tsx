import { createContext, type PropsWithChildren, useContext } from 'react';

/** Every string a primitive prints itself; a new one is a key here, never a label prop. */
export const UI_COPY_KEYS = [
  'close',
  'loading',
  'appearance',
  'theme',
  'mode',
  'modeSystem',
  'modeDark',
  'modeLight',
  'modeOled',
  'density',
  'densityComfortable',
  'densityCompact',
] as const;

export type UiCopyKey = (typeof UI_COPY_KEYS)[number];

export type UiCopy = Readonly<Record<UiCopyKey, string>>;

/** Every key's word, from the app's catalogue: one lookup, so a new key is never left out. */
export function uiCopyFrom(word: (key: UiCopyKey) => string): UiCopy {
  return Object.fromEntries(UI_COPY_KEYS.map((key) => [key, word(key)])) as UiCopy;
}

const UiCopyContext = createContext<UiCopy | undefined>(undefined);

export type UiCopyProviderProps = PropsWithChildren<{ copy: UiCopy }>;

/** Mounted once at each app's root, filled from the app's message catalogue. */
export function UiCopyProvider({ copy, children }: UiCopyProviderProps) {
  return <UiCopyContext value={copy}>{children}</UiCopyContext>;
}

export function useUiCopy(): UiCopy {
  const copy = useContext(UiCopyContext);
  if (copy === undefined) {
    throw new Error('useUiCopy must be used within UiCopyProvider');
  }
  return copy;
}
