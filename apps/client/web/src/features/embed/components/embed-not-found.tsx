import { useT } from '@vp/intl-react';

export function EmbedNotFound() {
  const { tOr } = useT();

  return (
    <main className="tw:flex tw:h-dvh tw:w-dvw tw:items-center tw:justify-center tw:bg-bg tw:p-4 tw:text-center tw:text-fg">
      <p role="status" className="tw:m-0">
        {tOr('player.unavailable', {}, '')}
      </p>
    </main>
  );
}
