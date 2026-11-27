import { assertNever, ignoreRejection } from '@kit/result';
import { useNavigate } from '@tanstack/react-router';
import { useAppLink } from '@vp/queries';
import { STUDIO_URL } from '#app/lib/config';
import type { ShellTarget } from './use-shell-destinations';

/** Goes to a shell destination from code, as a palette action does. */
export function useOpenDestination(): (target: ShellTarget) => void {
  const navigate = useNavigate();
  const appLink = useAppLink();

  return (target) => {
    switch (target.kind) {
      case 'page':
        ignoreRejection(
          navigate({ to: target.to }),
          'a refused navigation leaves the viewer where they are'
        );
        return;
      case 'channel':
        ignoreRejection(
          navigate({ to: '/channel/$channelId', params: { channelId: target.channelId } }),
          'a refused navigation leaves the viewer where they are'
        );
        return;
      case 'studio':
        window.location.assign(appLink(STUDIO_URL));
        return;
      default:
        assertNever(target, 'shell target');
    }
  };
}
