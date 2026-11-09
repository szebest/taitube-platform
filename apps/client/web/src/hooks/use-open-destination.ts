import { useNavigate } from '@tanstack/react-router';
import { assertNever } from '@vp/result';
import { STUDIO_URL } from '#app/lib/config';
import type { ShellTarget } from './use-shell-destinations';

/** Goes to a shell destination from code, as a palette action does. */
export function useOpenDestination(): (target: ShellTarget) => void {
  const navigate = useNavigate();

  return (target) => {
    switch (target.kind) {
      case 'page':
        navigate({ to: target.to });
        return;
      case 'channel':
        navigate({ to: '/channel/$channelId', params: { channelId: target.channelId } });
        return;
      case 'studio':
        window.location.assign(STUDIO_URL);
        return;
      default:
        assertNever(target, 'shell target');
    }
  };
}
