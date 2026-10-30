import { useNavigate, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useToast } from '@vp/ui';
import { useEffect, useEffectEvent } from 'react';

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
    navigate({
      to: '.',
      search: (previous) => ({ ...previous, denied: undefined }),
      replace: true,
    });
  });

  useEffect(() => {
    if (denied === undefined) {
      return;
    }

    report();
  }, [denied]);
}
