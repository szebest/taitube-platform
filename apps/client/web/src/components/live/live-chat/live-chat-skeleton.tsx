import { Skeleton } from '@vp/ui';

import { liveChatStyles } from './live-chat.variants';

const SKELETON_WIDTHS = ['60%', '85%', '40%', '75%', '90%', '50%', '70%', '45%'];

export function LiveChatSkeleton({ className }: { className?: string }) {
  const styles = liveChatStyles({ layout: 'docked' });

  return (
    <div data-slot="live-chat-skeleton" aria-hidden="true" className={styles.root({ className })}>
      <div className={styles.header()}>
        <Skeleton shape="text" className="w-1/3" />
      </div>
      <div className="flex flex-1 flex-col gap-stack px-inset-card py-inline">
        {SKELETON_WIDTHS.map((width) => (
          <div key={width} className="flex h-[2.25rem] items-center gap-inline">
            <Skeleton shape="circle" className="size-avatar-sm shrink-0" />
            <Skeleton shape="text" style={{ inlineSize: width }} />
          </div>
        ))}
      </div>
    </div>
  );
}
