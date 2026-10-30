import type { SearchMiddleware } from '@tanstack/react-router';
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { ResponsiveModal, type ResponsiveModalContentProps } from '@vp/ui';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { rememberOpener, restoreFocus } from './restore-focus';

export type UrlModalRegistry = Record<string, z.ZodObject>;

type NoModal = Record<never, never>;

type ModalSearch<TRegistry extends UrlModalRegistry> =
  | NoModal
  | {
      [Id in keyof TRegistry & string]: { modal: Id } & z.output<TRegistry[Id]>;
    }[keyof TRegistry & string];

type UrlModalState<TParams> =
  | { isOpen: false; params: undefined }
  | { isOpen: true; params: TParams };

declare module '@tanstack/react-router' {
  interface HistoryState {
    urlModal?: string;
  }
}

const MODAL_KEY = 'modal';

type SearchNavigate = (options: {
  to: '.';
  search: (prev: Record<string, unknown>) => Record<string, unknown>;
  replace?: boolean;
  state?: { urlModal: string };
}) => Promise<void>;

/**
 * One registry of modals, each with the zod schema of its own search params, and everything built
 * from it: the search fragment a route merges into its `validateSearch`, `useUrlModal(id)` (an id
 * the registry lacks does not compile), `UrlModal` and the `retainUrlModal` search middleware.
 */
export function createUrlModals<const TRegistry extends UrlModalRegistry>(registry: TRegistry) {
  type Id = keyof TRegistry & string;

  const members = Object.entries(registry).map(([id, params]) =>
    params.extend({ [MODAL_KEY]: z.literal(id) })
  );
  const anyModal = members.reduceRight<z.ZodType>((rest, member) => member.or(rest), z.object({}));
  const searchSchema = anyModal as z.ZodType<ModalSearch<TRegistry>>;
  const paramsOf = <TId extends Id>(id: TId): TRegistry[TId] => registry[id];
  const keysOf = (id: Id) => [MODAL_KEY, ...Object.keys(paramsOf(id).shape)];

  const retainUrlModal: SearchMiddleware<Record<string, unknown>> = ({ search, next }) => {
    const result = next(search);
    if (MODAL_KEY in result) {
      return result;
    }
    const kept = Object.entries(search).filter(([key]) =>
      Object.keys(registry).some((id) => keysOf(id).includes(key))
    );
    return { ...Object.fromEntries(kept), ...result };
  };

  function useUrlModal<TId extends Id>(id: TId) {
    const router = useRouter();
    const navigate: SearchNavigate = useNavigate() as unknown as SearchNavigate;
    const search = useSearch({ strict: false });
    const opened = router.state.location.state.urlModal === id;
    const parsed = paramsOf(id).safeParse(search);
    const state: UrlModalState<z.output<TRegistry[TId]>> =
      search[MODAL_KEY] === id && parsed.success
        ? { isOpen: true, params: parsed.data }
        : { isOpen: false, params: undefined };

    const open = (params: z.input<TRegistry[TId]>) => {
      rememberOpener();
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({ ...prev, ...params, [MODAL_KEY]: id }),
        state: { urlModal: id },
      });
    };

    const close = () => {
      if (opened) {
        router.history.back();
        return;
      }
      const cleared = Object.fromEntries(keysOf(id).map((key) => [key, undefined]));
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({ ...prev, ...cleared }),
        replace: true,
      });
    };

    return { ...state, open, close };
  }

  function UrlModalRoot({ id, children }: { id: Id; children: ReactNode }) {
    const { isOpen, close } = useUrlModal(id);

    return (
      <ResponsiveModal.Root open={isOpen} onOpenChange={(open) => !open && close()}>
        {children}
      </ResponsiveModal.Root>
    );
  }

  const UrlModal = {
    Root: UrlModalRoot,
    Content: (props: ResponsiveModalContentProps) => (
      <ResponsiveModal.Content onCloseAutoFocus={restoreFocus} {...props} />
    ),
    Title: ResponsiveModal.Title,
    Description: ResponsiveModal.Description,
    Body: ResponsiveModal.Body,
    Footer: ResponsiveModal.Footer,
    Close: ResponsiveModal.Close,
  };

  return { searchSchema, retainUrlModal, useUrlModal, UrlModal };
}
