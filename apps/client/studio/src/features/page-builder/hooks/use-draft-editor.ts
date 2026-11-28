import { useMutation } from '@tanstack/react-query';
import type { ChannelPageDraftView } from '@vp/api-contracts';
import type { ChannelLayout } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { failureCode, useApi } from '@vp/queries';
import { useEffect, useEffectEvent, useState } from 'react';
import { type LayoutProblem, layoutProblem } from '../utils/layout-problem';
import { useSaveDraft } from './use-page-mutations';

export const AUTOSAVE_DELAY_MS = 1500;

export type DraftStatus = 'saved' | 'unsaved' | 'saving' | 'invalid' | 'failed' | 'conflict';

export interface DraftEditor {
  document: ChannelLayout;
  version: number;
  status: DraftStatus;
  problem: LayoutProblem | null;
  failure: unknown;
  edit: (next: ChannelLayout) => void;
  saveThen: (next?: (version: number) => void) => void;
  reload: () => void;
  overwrite: () => void;
}

/** The draft held in the browser: edits are autosaved under the version it was read at, and a conflict waits for the creator's choice. */
export function useDraftEditor(initial: ChannelPageDraftView): DraftEditor {
  const api = useApi();
  const [document, setDocument] = useState(initial.document);
  const [saved, setSaved] = useState(initial.document);
  const [version, setVersion] = useState(initial.version);
  const [conflict, setConflict] = useState(false);
  const save = useSaveDraft();
  const latest = useMutation({ mutationFn: () => api.channelPageStudio.getChannelPageDraft() });

  const problem = layoutProblem(document);
  const dirty = document !== saved;
  const blocked = conflict || problem !== null || save.isError;

  const saveAt = (at: number, next?: (version: number) => void) =>
    save.mutate(
      { document, version: at },
      {
        onSuccess: (draft) => {
          setVersion(draft.version);
          setSaved(document);
          next?.(draft.version);
        },
        onError: (error) => setConflict(failureCode(error) === ErrorCodes.VERSION_CONFLICT),
      }
    );

  const autosave = useEffectEvent(() => saveAt(version));

  useEffect(() => {
    if (!dirty || blocked || save.isPending) {
      return;
    }
    const timer = setTimeout(() => autosave(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, blocked, save.isPending, document]);

  const edit = (next: ChannelLayout) => {
    if (save.isError) {
      save.reset();
    }
    setDocument(next);
  };

  const saveThen = (next?: (version: number) => void) => {
    if (dirty) {
      saveAt(version, next);
      return;
    }
    next?.(version);
  };

  const reload = () =>
    latest.mutate(undefined, {
      onSuccess: (draft) => {
        setDocument(draft.document);
        setSaved(draft.document);
        setVersion(draft.version);
        setConflict(false);
      },
    });

  const overwrite = () =>
    latest.mutate(undefined, {
      onSuccess: (draft) => {
        setConflict(false);
        saveAt(draft.version);
      },
    });

  const status = ((): DraftStatus => {
    if (conflict) {
      return 'conflict';
    }
    if (save.isPending) {
      return 'saving';
    }
    if (save.isError) {
      return 'failed';
    }
    if (problem !== null) {
      return 'invalid';
    }
    return dirty ? 'unsaved' : 'saved';
  })();

  return {
    document,
    version,
    status,
    problem,
    failure: save.error,
    edit,
    saveThen,
    reload,
    overwrite,
  };
}
