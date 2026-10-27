import {
  Avatar,
  Button,
  buttonStyles,
  DropdownMenu,
  Icon,
  IconButton,
  type IconId,
  Skeleton,
  Slot,
  useUiCopy,
  VisuallyHidden,
} from '@vp/ui';
import {
  type ComponentProps,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from 'react';
import { EngagementBarContext, useEngagementBar } from './engagement-bar.context';
import { engagementBarStyles } from './engagement-bar.variants';
import type { EngagementBarLayout, EngagementBarReaction as ReactionValue } from './types';

const SKELETON_ACTIONS = ['share', 'save', 'queue'];

export interface EngagementBarRootProps extends ComponentPropsWithRef<'div'> {
  /** Follows the breakpoint when omitted: stacked below expanded, one row from there. */
  layout?: EngagementBarLayout;
}

/** The row under the watch page title: the channel, subscribe, then the reactions and actions. */
export function EngagementBarRoot({ layout, className, ...props }: EngagementBarRootProps) {
  return (
    <EngagementBarContext value={{ layout }}>
      <div
        data-slot="engagement-bar"
        data-layout={layout}
        className={engagementBarStyles().root({ className })}
        {...props}
      />
    </EngagementBarContext>
  );
}

export interface EngagementBarChannelProps extends ComponentPropsWithRef<'div'> {
  name: string;
  avatarSrc?: string;
  /** The subscriber count, finished by the caller. */
  subscribers?: string;
  /** Draws the channel on the one child the caller passes, a router `Link`. */
  asChild?: boolean;
}

export function EngagementBarChannel({
  name,
  avatarSrc,
  subscribers,
  asChild = false,
  className,
  children,
  ...props
}: EngagementBarChannelProps) {
  const styles = engagementBarStyles();
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="engagement-bar-channel"
      className={styles.channel({ className })}
      {...props}
    >
      {asChild && <Slot.Slottable>{children}</Slot.Slottable>}
      <Avatar.Root size="lg">
        {avatarSrc && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback aria-hidden="true">{name.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <span className={styles.channelText()}>
        <span className={styles.channelName()}>{name}</span>
        {subscribers && <span className={styles.channelMeta()}>{subscribers}</span>}
      </span>
    </Element>
  );
}

export interface EngagementBarSubscribeProps
  extends Omit<ComponentPropsWithRef<'button'>, 'onToggle'> {
  subscribed: boolean;
  pending?: boolean;
  onToggle: () => void;
}

/** A toggle: primary to subscribe, the quiet accent once subscribed; its label is the caller's. */
export function EngagementBarSubscribe({
  subscribed,
  pending = false,
  onToggle,
  children,
  ...props
}: EngagementBarSubscribeProps) {
  return (
    <>
      <Button
        data-slot="engagement-bar-subscribe"
        variant={subscribed ? 'soft' : 'solid'}
        tone={subscribed ? 'neutral' : 'accent'}
        shape="pill"
        aria-pressed={subscribed}
        loading={pending}
        onClick={onToggle}
        {...props}
      >
        {subscribed && <Icon name="check" />}
        {children}
      </Button>
      <VisuallyHidden aria-live="polite">{subscribed ? children : null}</VisuallyHidden>
    </>
  );
}

function focusSibling(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

  const toolbar = event.currentTarget;
  const controls = [...toolbar.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
  const at = controls.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;

  const forward = (event.key === 'ArrowRight') === (getComputedStyle(toolbar).direction !== 'rtl');
  const next = controls[(at + (forward ? 1 : -1) + controls.length) % controls.length];
  event.preventDefault();
  next?.focus();
}

/** The toolbar of reactions and actions; arrows move between them. */
export function EngagementBarActions({
  className,
  onKeyDown,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { layout } = useEngagementBar('Actions');
  const { videoActions } = useUiCopy();

  return (
    <div
      role="toolbar"
      aria-label={videoActions}
      data-slot="engagement-bar-actions"
      className={engagementBarStyles({ layout: layout ?? 'auto' }).actions({ className })}
      onKeyDown={(event) => {
        focusSibling(event);
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
}

/** A count the caller formats; it fades in afresh each time it changes, never on the first paint. */
export function RollingCount({ value, className }: { value: string; className?: string }) {
  const [shown, setShown] = useState(value);
  const [changed, setChanged] = useState(false);

  if (shown !== value) {
    setShown(value);
    setChanged(true);
  }

  return (
    <span
      key={value}
      className={engagementBarStyles().count({
        className: [changed && 'tw:motion-safe:animate-fade-in', className],
      })}
    >
      {value}
    </span>
  );
}

export interface EngagementBarReactionProps
  extends Omit<ComponentPropsWithRef<'fieldset'>, 'onChange'> {
  value: ReactionValue;
  /** The like count, finished by the caller. */
  likes: string;
  onChange: (next: ReactionValue) => void;
}

/** Like and dislike, two joined toggles; pressing the held one clears it. */
export function EngagementBarReaction({
  value,
  likes,
  onChange,
  className,
  ...props
}: EngagementBarReactionProps) {
  const { like, dislike } = useUiCopy();
  const styles = engagementBarStyles();

  return (
    <fieldset
      data-slot="engagement-bar-reaction"
      className={styles.reaction({ className })}
      {...props}
    >
      <Button
        variant="soft"
        className={styles.reactionHalf()}
        aria-label={`${like} ${likes}`}
        aria-pressed={value === 'LIKE'}
        onClick={() => onChange(value === 'LIKE' ? null : 'LIKE')}
      >
        <Icon name="like" />
        <RollingCount value={likes} />
      </Button>
      <span
        aria-hidden="true"
        className="tw:my-inline tw:self-stretch tw:border-s-divider tw:border-border"
      />
      <IconButton
        variant="soft"
        className={styles.reactionHalf()}
        aria-label={dislike}
        aria-pressed={value === 'DISLIKE'}
        onClick={() => onChange(value === 'DISLIKE' ? null : 'DISLIKE')}
      >
        <Icon name="dislike" />
      </IconButton>
    </fieldset>
  );
}

export type EngagementBarActionProps = ComponentPropsWithRef<'button'> & {
  icon: IconId;
  /** The viewer's own state, saved or queued: a toggle in the accent. */
  pressed?: boolean;
  asChild?: boolean;
};

/** A pill with its icon and label; the label hides on compact and stays the accessible name. */
export function EngagementBarAction({
  icon,
  pressed,
  asChild = false,
  className,
  children,
  ...props
}: EngagementBarActionProps) {
  const Element = asChild ? Slot.Root : 'button';

  return (
    <Element
      data-slot="engagement-bar-action"
      type={asChild ? undefined : 'button'}
      aria-pressed={pressed}
      className={buttonStyles({ variant: 'soft', shape: 'pill', className })}
      {...props}
    >
      <Icon name={icon} />
      {asChild ? (
        <Slot.Slottable>{children}</Slot.Slottable>
      ) : (
        <span className={engagementBarStyles().actionLabel()}>{children}</span>
      )}
    </Element>
  );
}

export interface EngagementBarOverflowProps extends ComponentProps<typeof DropdownMenu.Root> {
  /** `DropdownMenu.Item`s for the actions that do not fit. */
  children: ReactNode;
}

/** The menu at the end of the toolbar for the actions the row has no room for. */
export function EngagementBarOverflow({ children, ...props }: EngagementBarOverflowProps) {
  const { moreActions } = useUiCopy();

  return (
    <DropdownMenu.Root {...props}>
      <DropdownMenu.Trigger asChild>
        <IconButton variant="soft" aria-label={moreActions}>
          <Icon name="more-h" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">{children}</DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export function EngagementBarSkeleton({ className }: { className?: string }) {
  const styles = engagementBarStyles();

  return (
    <div
      data-slot="engagement-bar-skeleton"
      aria-hidden="true"
      className={styles.root({ className })}
    >
      <div className={styles.channel()}>
        <Skeleton shape="circle" className="tw:size-avatar-lg" />
        <span className={styles.channelText({ className: 'tw:gap-inline' })}>
          <Skeleton radius="xs" className="tw:h-[1.375rem] tw:w-[8.75rem]" />
          <Skeleton radius="xs" className="tw:h-[1.25rem] tw:w-[6rem]" />
        </span>
      </div>
      <Skeleton radius="chip" className="tw:h-control-md tw:w-[7.5rem]" />
      <div className={engagementBarStyles({ layout: 'auto' }).actions()}>
        <Skeleton radius="chip" className="tw:h-control-md tw:w-[11.75rem] tw:shrink-0" />
        {SKELETON_ACTIONS.map((action) => (
          <Skeleton
            key={action}
            radius="chip"
            className="tw:h-control-md tw:w-[6rem] tw:shrink-0"
          />
        ))}
      </div>
    </div>
  );
}
