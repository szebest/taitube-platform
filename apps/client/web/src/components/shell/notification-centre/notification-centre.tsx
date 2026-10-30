import { Avatar, Badge, Button, Drawer, Icon, Popover, Skeleton, Slot, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useId,
  useState,
} from 'react';
import { NotificationCentreContext, useNotificationCentre } from './notification-centre.context';
import { notificationCentreStyles } from './notification-centre.variants';
import type { NotificationCentreLayout } from './types';

const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];

const ITEM = '[data-slot="notification-centre-item"]';

export interface NotificationCentreRootProps {
  /** `popover` from medium up, `sheet` on compact; the wrapper picks it by breakpoint. */
  layout?: NotificationCentreLayout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The finished unread count, capped by the wrapper ("9+"); absent means no badge. */
  unread?: string;
  children?: ReactNode;
}

/** The header bell and the panel it opens: a non-modal popover, or a modal bottom sheet on compact. */
export function NotificationCentreRoot({
  layout = 'popover',
  open,
  onOpenChange,
  unread,
  children,
}: NotificationCentreRootProps) {
  const titleId = useId();
  const Primitive = layout === 'popover' ? Popover.Root : Drawer.Root;

  return (
    <NotificationCentreContext value={{ layout, open, setOpen: onOpenChange, unread, titleId }}>
      <Primitive open={open} onOpenChange={onOpenChange}>
        {children}
      </Primitive>
    </NotificationCentreContext>
  );
}

/** The bell, with the unread badge in its name. */
export function NotificationCentreTrigger({
  className,
  ...props
}: Omit<ComponentPropsWithRef<'button'>, 'children'>) {
  const { layout, unread } = useNotificationCentre('Trigger');
  const { notifications } = useUiCopy();
  const styles = notificationCentreStyles();
  const Trigger = layout === 'popover' ? Popover.Trigger : Drawer.Trigger;

  return (
    <Trigger asChild>
      <Button
        data-slot="notification-centre-trigger"
        variant="ghost"
        shape="icon"
        className={styles.trigger({ className })}
        {...props}
      >
        <Icon name="bell" />
        <span className="tw:sr-only">{notifications}</span>{' '}
        {unread && (
          <Badge tone="accent" variant="solid" size="sm" className={styles.badge()}>
            {unread}
          </Badge>
        )}
      </Button>
    </Trigger>
  );
}

/** The panel; arrows move between its items. */
export function NotificationCentrePanel({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { layout, titleId } = useNotificationCentre('Panel');
  const styles = notificationCentreStyles({ layout });

  const moveBetweenItems = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step === undefined) {
      return;
    }
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(ITEM)];
    const active = document.activeElement;
    const current = active instanceof HTMLElement ? items.indexOf(active) : -1;
    const next = items[Math.min(Math.max(current + step, 0), items.length - 1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  if (layout === 'sheet') {
    return (
      <Drawer.Content
        data-slot="notification-centre-panel"
        aria-describedby={undefined}
        className={styles.panel({ className })}
        onKeyDown={moveBetweenItems}
        {...props}
      >
        <Drawer.Handle />
        {children}
      </Drawer.Content>
    );
  }

  return (
    <Popover.Content
      data-slot="notification-centre-panel"
      side="block-end"
      align="end"
      aria-labelledby={titleId}
      className={styles.panel({ className })}
      onKeyDown={moveBetweenItems}
      {...props}
    >
      {children}
    </Popover.Content>
  );
}

/** The heading, then the caller's actions (Mark all read) at the end. */
export function NotificationCentreHeader({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'>) {
  const { layout, titleId } = useNotificationCentre('Header');
  const { notifications } = useUiCopy();
  const styles = notificationCentreStyles();

  return (
    <div data-slot="notification-centre-header" className={styles.header({ className })} {...props}>
      {layout === 'sheet' ? (
        <Drawer.Title className={styles.title()}>{notifications}</Drawer.Title>
      ) : (
        <h2 id={titleId} className={styles.title()}>
          {notifications}
        </h2>
      )}
      {children}
    </div>
  );
}

/** Marks every notification read, and says so politely. */
export function NotificationCentreMarkAllRead({
  onClick,
  ...props
}: Omit<ComponentPropsWithRef<'button'>, 'children'>) {
  const { markAllRead, allMarkedRead } = useUiCopy();
  const [marked, setMarked] = useState(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    setMarked(true);
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleClick} {...props}>
        {markAllRead}
      </Button>
      <span role="status" className="tw:sr-only">
        {marked ? allMarkedRead : ''}
      </span>
    </>
  );
}

/** Where the caller's filter tabs or chips go. */
export function NotificationCentreFilters({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const styles = notificationCentreStyles();

  return (
    <div
      data-slot="notification-centre-filters"
      className={styles.filters({ className })}
      {...props}
    />
  );
}

/** The scrolling list of groups, or the empty state, the skeleton or the error in their place. */
export function NotificationCentreBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const styles = notificationCentreStyles();

  return (
    <div data-slot="notification-centre-body" className={styles.body({ className })} {...props} />
  );
}

/** A one-line notice above the list, such as the offline line over cached items. */
export function NotificationCentreNotice({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const styles = notificationCentreStyles();

  return (
    <div
      data-slot="notification-centre-notice"
      role="status"
      className={styles.notice({ className })}
      {...props}
    />
  );
}

export interface NotificationCentreGroupProps extends ComponentPropsWithRef<'section'> {
  heading: ReactNode;
}

export function NotificationCentreGroup({
  heading,
  className,
  children,
  ...props
}: NotificationCentreGroupProps) {
  const headingId = useId();
  const styles = notificationCentreStyles();

  return (
    <section
      data-slot="notification-centre-group"
      aria-labelledby={headingId}
      className={styles.group({ className })}
      {...props}
    >
      <h3 id={headingId} className={styles.groupHeading()}>
        {heading}
      </h3>
      <ul className={styles.list()}>{children}</ul>
    </section>
  );
}

export interface NotificationCentreItemProps
  extends Omit<ComponentPropsWithRef<'button'>, 'onSelect'> {
  unread?: boolean;
  avatarSrc?: string;
  time: string;
  thumbnailSrc?: string;
  onSelect: () => void;
  /** Draws the item on the caller's router link; its children are the text. */
  asChild?: boolean;
}

export function NotificationCentreItem({
  unread = false,
  avatarSrc,
  time,
  thumbnailSrc,
  onSelect,
  asChild = false,
  className,
  children,
  ...props
}: NotificationCentreItemProps) {
  const { unread: unreadWord } = useUiCopy();
  const styles = notificationCentreStyles();
  const Element = asChild ? Slot.Root : 'button';

  return (
    <li className={styles.row()} data-unread={unread ? '' : undefined}>
      <span aria-hidden="true" className={styles.dot()} />
      <Element
        data-slot="notification-centre-item"
        type={asChild ? undefined : 'button'}
        className={styles.item({ className })}
        onClick={onSelect}
        {...props}
      >
        <Avatar.Root size="md" className={styles.avatar()} aria-hidden="true">
          {avatarSrc && <Avatar.Image src={avatarSrc} alt="" />}
          <Avatar.Fallback>
            <Icon name="bell" size="sm" />
          </Avatar.Fallback>
        </Avatar.Root>
        {asChild ? (
          <Slot.Slottable>{children}</Slot.Slottable>
        ) : (
          <span className={styles.text()}>{children}</span>
        )}{' '}
        <span className={styles.time()}>
          {time}
          {unread && <span className="tw:sr-only">, {unreadWord}</span>}
        </span>
        {thumbnailSrc && <img src={thumbnailSrc} alt="" className={styles.thumbnail()} />}
      </Element>
    </li>
  );
}

export function NotificationCentreSkeleton() {
  const styles = notificationCentreStyles();

  return (
    <div
      data-slot="notification-centre-skeleton"
      aria-hidden="true"
      className="tw:flex tw:h-[30rem] tw:w-[25rem] tw:max-w-full tw:flex-col tw:overflow-hidden tw:rounded-card tw:bg-raised"
    >
      <div className={styles.header()}>
        <Skeleton shape="text" className="tw:w-[8rem]" />
      </div>
      {SKELETON_ROWS.map((row) => (
        <div
          key={row}
          className="tw:flex tw:h-[4.5rem] tw:items-center tw:gap-stack tw:ps-inset-card tw:pe-inset-control"
        >
          <Skeleton shape="circle" className="tw:size-control-md tw:shrink-0" />
          <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-inline">
            <Skeleton shape="text" className="tw:w-full" />
            <Skeleton shape="text" className="tw:w-[60%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
