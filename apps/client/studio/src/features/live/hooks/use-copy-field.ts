import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { useToast } from '@vp/ui';

/** Copies a value to the clipboard and toasts which field it was, or that the browser refused. */
export function useCopyField() {
  const toast = useToast();
  const { tOr } = useT();

  return async (label: string, value: string) => {
    const copied = await fromPromise(
      () => navigator.clipboard.writeText(value),
      (cause) => cause
    );

    toast(
      isOk(copied)
        ? { tone: 'success', title: tOr('studio.liveCopied', { label }, '') }
        : { tone: 'danger', title: tOr('studio.liveCopyFailed', { label }, '') }
    );
  };
}
