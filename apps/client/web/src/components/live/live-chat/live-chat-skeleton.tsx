import { Skeleton } from '@vp/ui';

import { liveChatStyles } from './live-chat.variants';

const SKELETON_WIDTHS = ['60%', '85%', '40%', '75%', '90%', '50%', '70%', '45%'];

export function LiveChatSkeleton({ className }: { className?: string }) {
  const styles = liveChatStyles({ layout: 'docked' });

  return (
    <div data-slot="live-chat-skeleton" aria-hidden="true" className={styles.root({ className })}>
      <div className={styles.header()}>
        <Skeleton shape="text" className="tw:w-1/3" />
      </div>
      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-stack tw:px-inset-card tw:py-inline">
        {SKELETON_WIDTHS.map((width) => (
          <div key={width} className="tw:flex tw:h-[2.25rem] tw:items-center tw:gap-inline">
            <Skeleton shape="circle" className="tw:size-avatar-sm tw:shrink-0" />
            <Skeleton shape="text" style={{ inlineSize: width }} />
          </div>
        ))}
      </div>
    </div>
  );
}
