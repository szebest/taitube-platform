import { useT } from '@vp/intl-react';
import { useToast } from '@vp/ui';

import { failureCode } from './failure-code';
import { present } from './present-failure';

/**
 * A failed mutation's toast: what failed, the presented copy for the error and, when the caller can
 * run it again, a retry action.
 */
export function useFailureToast(): (title: string, error: unknown, retry?: () => void) => void {
  const showToast = useToast();
  const { tOr } = useT();

  return (title, error, retry) =>
    showToast({
      tone: 'danger',
      title,
      description: tOr(present({ code: failureCode(error) }).copy, {}, ''),
      action: retry && { label: tOr('ui.retry', {}, ''), onAction: retry },
    });
}
