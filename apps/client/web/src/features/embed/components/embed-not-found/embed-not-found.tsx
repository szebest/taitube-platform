import { useT } from '@vp/intl-react';

export function EmbedNotFound() {
  const { tOr } = useT();

  return (
    <main className="flex h-dvh w-dvw items-center justify-center bg-bg p-4 text-center text-fg">
      <p role="status" className="m-0">
        {tOr('player.unavailable', {}, '')}
      </p>
    </main>
  );
}
