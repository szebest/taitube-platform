import { ignoreRejection } from '@kit/result';
import { useToast } from '@kit/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useEffectEvent } from 'react';
import { useT } from '#app/lib/messages';

/** Shows the denial a redirect carried in `?denied=` as a toast, once, and takes the param off the URL. */
export function useAccessDeniedToast() {
  const denied = useSearch({ strict: false, select: (search) => search.denied });
  const navigate = useNavigate();
  const toast = useToast();
  const { tOr } = useT();

  const report = useEffectEvent(() => {
    toast({
      tone: 'danger',
      title: tOr('studio.adminDeniedTitle', {}, ''),
      description: tOr('studio.adminDeniedDescription', {}, ''),
    });
    ignoreRejection(
      navigate({
        to: '.',
        search: (previous) => ({ ...previous, denied: undefined }),
        replace: true,
      }),
      'a refused navigation leaves the viewer where they are'
    );
  });

  useEffect(() => {
    if (denied === undefined) {
      return;
    }

    report();
  }, [denied]);
}
