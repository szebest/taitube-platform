import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';

type CommandPaletteStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CommandPaletteStoreContext = createContext<CommandPaletteStore | undefined>(undefined);

function ownsKeystrokes(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[role="menu"], [role="dialog"]') !== null
  );
}

function isSlash(event: KeyboardEvent) {
  return (
    event.key === '/' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !ownsKeystrokes(event.target)
  );
}

function isModK(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k';
}

/** Whether the command palette is open; `/` outside a field opens it, Cmd or Ctrl K toggles it anywhere. */
export function CommandPaletteProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);

  const answerShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }
    if (isModK(event)) {
      event.preventDefault();
      setOpen(!open);
      return;
    }
    if (isSlash(event)) {
      event.preventDefault();
      setOpen(true);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => answerShortcut(event);
    document.addEventListener('keydown', listener);
    const stopListening = () => document.removeEventListener('keydown', listener);
    return stopListening;
  }, []);

  return (
    <CommandPaletteStoreContext value={{ open, setOpen }}>{children}</CommandPaletteStoreContext>
  );
}

export function useCommandPaletteStore(): CommandPaletteStore {
  const store = use(CommandPaletteStoreContext);
  if (store === undefined) {
    throw new Error('useCommandPaletteStore must be used within CommandPaletteProvider');
  }
  return store;
}
