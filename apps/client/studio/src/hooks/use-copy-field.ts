import { useT } from '@kit/intl-react';
import { fromPromise, isOk } from '@kit/result';
import { useToast } from '@kit/ui';

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
        ? { tone: 'success', title: tOr('studio.copiedField', { label }, '') }
        : { tone: 'danger', title: tOr('studio.copyFieldFailed', { label }, '') }
    );
  };
}
