import { useRouter } from '@tanstack/react-router';
import { failureCode } from '@vp/queries';
import { ERROR_COPY } from '@vp/shared-messages';
import { AccessGate } from '#app/components/watch/access-gate';
import { useUnlockVideo } from '#app/features/watch/hooks/use-unlock-video';
import { useT } from '#app/lib/messages';

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
