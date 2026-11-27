import { createContext, type PropsWithChildren, useContext } from 'react';

/** Every string a primitive prints itself; a new one is a key here, never a label prop. */
export const UI_COPY_KEYS = [
  'close',
  'loading',
  'required',
  'noResults',
  'reorder',
  'pickedUp',
  'movedTo',
  'droppedAt',
  'cancelled',
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
  'retry',
  'breadcrumb',
  'account',
  'reference',
  'copy',
  'copied',
  'technicalDetails',
  'moreActions',
  'addToQueue',
  'playNext',
  'live',
  'watched',
  'save',
  'scrollBack',
  'scrollForward',
  'pinnedByCreator',
  'startHere',
  'mostWatched',
  'mostViewed',
  'noDataYet',
  'loadFailed',
  'disclosureLabel',
  'disclosureSilent',
  'disclosureVisible',
  'tagRemove',
  'tagDuplicate',
] as const;

export type UiCopyKey = (typeof UI_COPY_KEYS)[number];

export type UiCopy = Readonly<Record<UiCopyKey, string>>;

const isComplete = (copy: Record<string, unknown>): copy is UiCopy =>
  UI_COPY_KEYS.every((key) => typeof copy[key] === 'string');

/** Every key's word, from the app's catalogue: one lookup, so a new key is never left out. */
export function uiCopyFrom(word: (key: UiCopyKey) => string): UiCopy {
  const copy = Object.fromEntries(UI_COPY_KEYS.map((key) => [key, word(key)]));
  if (!isComplete(copy)) {
    throw new TypeError('uiCopyFrom: the lookup answered a key with something other than a string');
  }
  return copy;
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
