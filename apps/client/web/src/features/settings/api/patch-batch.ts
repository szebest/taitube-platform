import { mergeChanges, type PreferencesChange } from './preferences-change';

export interface PatchBatch {
  add: (change: PreferencesChange) => void;
  /** Sends what is waiting now. */
  flush: () => void;
  /** Drops what is waiting. */
  cancel: () => void;
}

/** Gathers the changes made within `delayMs` of each other into one, handed to `send` once. */
export function createPatchBatch(
  send: (change: PreferencesChange) => void,
  delayMs: number
): PatchBatch {
  let waiting: PreferencesChange | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    waiting = undefined;
  };

  const flush = () => {
    const change = waiting;
    cancel();
    if (change) send(change);
  };

  return {
    add: (change) => {
      waiting = waiting ? mergeChanges(waiting, change) : change;
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel,
  };
}
