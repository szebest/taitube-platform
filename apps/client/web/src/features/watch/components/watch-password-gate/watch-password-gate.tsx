import { useT } from '@kit/intl-react';
import { useRouter } from '@tanstack/react-router';
import { ERROR_COPY } from '@vp/messages';
import { failureCode } from '@vp/queries';
import { AccessGate } from '#app/components/watch/access-gate';
import { useUnlockVideo } from '#app/features/watch/hooks/use-unlock-video';

/** `/watch/$videoId` for a password-protected video: the password lifts the gate and the page loads again. */
export function WatchPasswordGate({ videoId }: { videoId: string }) {
  const { tOr } = useT();
  const router = useRouter();
  const unlock = useUnlockVideo(videoId);

  return (
    <AccessGate.Root icon="lock">
      <AccessGate.Title>{tOr('watch.lockedTitle', {}, '')}</AccessGate.Title>
      <AccessGate.Description>{tOr('watch.lockedDescription', {}, '')}</AccessGate.Description>
      <AccessGate.PasswordForm
        label={tOr('watch.lockedPassword', {}, '')}
        submitLabel={tOr('watch.lockedUnlock', {}, '')}
        pending={unlock.isPending}
        error={unlock.error ? tOr(ERROR_COPY[failureCode(unlock.error)], {}, '') : undefined}
        onUnlock={(password) => unlock.mutate(password, { onSuccess: () => router.invalidate() })}
      />
    </AccessGate.Root>
  );
}
