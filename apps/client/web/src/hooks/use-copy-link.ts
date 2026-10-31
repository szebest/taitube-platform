import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { useToast } from '@vp/ui';

/** Copies a link to the clipboard and says whether it worked. */
export function useCopyLink(): (link: string) => Promise<void> {
  const showToast = useToast();
  const { tOr } = useT();

  return async (link) => {
    const copied = await fromPromise(
      () => navigator.clipboard.writeText(link),
      (cause) => cause
    );

    showToast(
      isOk(copied)
        ? { tone: 'success', title: tOr('watch.linkCopied', {}, '') }
        : { tone: 'danger', title: tOr('watch.copyFailed', {}, '') }
    );
  };
}
