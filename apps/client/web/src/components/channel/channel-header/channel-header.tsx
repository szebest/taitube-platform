import {
  Avatar,
  Badge,
  Button,
  type ButtonProps,
  Icon,
  IconButton,
  Skeleton,
  Slot,
  useUiCopy,
} from '@vp/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { ChannelHeaderContext, useChannelHeader } from './channel-header.context';
import { channelHeaderStyles } from './channel-header.variants';
import type { ChannelHeaderLayout } from './types';

export interface ChannelHeaderRootProps extends ComponentPropsWithRef<'div'> {
  layout?: ChannelHeaderLayout;
  /** A CSS colour sampled from the latest upload, painted only as a decorative tint. */
  glowColor?: string;
}

/** The top of a channel: banner, identity row and tabs; `identity` keeps only the row, for a search result. */
export function ChannelHeaderRoot({
  layout = 'full',
  glowColor,
  className,
  ...props
}: ChannelHeaderRootProps) {
  return (
    <ChannelHeaderContext value={{ layout, glowColor }}>
      <div
        data-slot="channel-header"
        data-layout={layout}
        className={channelHeaderStyles({ layout }).root({ className })}
        {...props}
      />
    </ChannelHeaderContext>
  );
}

export interface ChannelHeaderBannerProps extends ComponentPropsWithRef<'img'> {
  /** Styles the media element the caller passes (a `picture`) in place of the `img`. */
  asChild?: boolean;
}

/** The banner image, or a tint of the sampled colour over `surface` at the same height when there is none. */
export function ChannelHeaderBanner({
  src,
  alt = '',
  asChild = false,
  className,
  ...props
}: ChannelHeaderBannerProps) {
  const { layout, glowColor } = useChannelHeader('Banner');
  const styles = channelHeaderStyles({ layout });

  if (layout === 'identity') {
    return null;
  }

  const media = asChild ? (
    <Slot.Root className={styles.bannerMedia()} {...props} />
  ) : (
    src !== undefined && <img src={src} alt={alt} className={styles.bannerMedia()} {...props} />
  );

  return (
    <div data-slot="channel-header-banner" className={styles.bannerFrame()}>
      {glowColor !== undefined && (
        <div aria-hidden="true" className={styles.glow()} style={{ backgroundColor: glowColor }} />
      )}
      <div className={styles.banner({ className })}>
        {media ||
          (glowColor !== undefined && (
            <div aria-hidden="true" className={styles.bannerTint()}>
              <div className="tw:size-full" style={{ backgroundColor: glowColor }} />
              <div className={styles.bannerFade()} />
            </div>
          ))}
      </div>
    </div>
  );
}

export interface ChannelHeaderIdentityProps
  extends Omit<ComponentPropsWithRef<'header'>, 'children'> {
  name: string;
  handle: string;
  avatarSrc?: string;
  /** Finished, e.g. "284K subscribers · 86 videos". */
  stats?: string;
  verified?: boolean;
  live?: boolean;
  /** Draws the row on the link the caller passes, for a channel result that leads to the channel. */
  asChild?: boolean;
  children?: ReactNode;
}

/** Avatar, name (the page's `h1` in the full layout), handle and stats; `Bio` and `Actions` go in as children. */
export function ChannelHeaderIdentity({
  name,
  handle,
  avatarSrc,
  stats,
  verified = false,
  live = false,
  asChild = false,
  className,
  children,
  ...props
}: ChannelHeaderIdentityProps) {
  const { layout } = useChannelHeader('Identity');
  const copy = useUiCopy();
  const styles = channelHeaderStyles({ layout });
  const Element = asChild ? Slot.Root : 'header';
  const Heading = layout === 'full' ? 'h1' : 'h2';

  return (
    <Element
      data-slot="channel-header-identity"
      className={styles.identity({ className })}
      {...props}
    >
      <Avatar.Root size="xl" tone={live ? 'live' : 'neutral'} className={styles.avatar()}>
        {avatarSrc !== undefined && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback aria-hidden="true">{name.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <div className={styles.nameRow()}>
        <Heading className={styles.name()}>{name}</Heading>
        {verified && (
          <Icon
            name="verified"
            size="md"
            aria-label={copy.verified}
            className={styles.verified()}
          />
        )}
        {live && (
          <Badge variant="solid" tone="live">
            {copy.live}
          </Badge>
        )}
      </div>
      <p className={styles.stats()}>{stats === undefined ? handle : `${handle} · ${stats}`}</p>
      <Slot.Slottable>{children}</Slot.Slottable>
    </Element>
  );
}

export interface ChannelHeaderBioProps extends ComponentPropsWithRef<'div'> {
  /** The "more" link to About, after the two lines. */
  more?: ReactNode;
}

export function ChannelHeaderBio({ more, className, children, ...props }: ChannelHeaderBioProps) {
  const styles = channelHeaderStyles({ layout: useChannelHeader('Bio').layout });

  return (
    <div data-slot="channel-header-bio" className={styles.bio({ className })} {...props}>
      <p className={styles.bioText()}>{children}</p>
      {more}
    </div>
  );
}

export function ChannelHeaderActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const styles = channelHeaderStyles({ layout: useChannelHeader('Actions').layout });

  return (
    <div data-slot="channel-header-actions" className={styles.actions({ className })} {...props} />
  );
}

export type ChannelHeaderSubscribeProps = Omit<
  ButtonProps,
  'variant' | 'tone' | 'asChild' | 'loading'
> & {
  subscribed: boolean;
  /** Holds the optimistic result with a spinner in the button. */
  pending?: boolean;
};

/** A toggle: Subscribe in the accent, Subscribed as a quiet button with a check. */
export function ChannelHeaderSubscribe({
  subscribed,
  pending = false,
  className,
  children,
  ...props
}: ChannelHeaderSubscribeProps) {
  const styles = channelHeaderStyles({ layout: useChannelHeader('Subscribe').layout });

  return (
    <Button
      data-slot="channel-header-subscribe"
      variant={subscribed ? 'soft' : 'solid'}
      tone={subscribed ? 'neutral' : 'accent'}
      aria-pressed={subscribed}
      loading={pending}
      className={styles.subscribe({ className })}
      {...props}
    >
      {subscribed && <Icon name="check" />}
      {children}
    </Button>
  );
}

/** The notification bell beside Subscribed. */
export function ChannelHeaderBell(
  props: Omit<ComponentPropsWithRef<'button'>, 'aria-label' | 'children'>
) {
  useChannelHeader('Bell');
  const { notifications } = useUiCopy();

  return (
    <IconButton
      data-slot="channel-header-bell"
      variant="soft"
      aria-label={notifications}
      {...props}
    >
      <Icon name="bell" />
    </IconButton>
  );
}

/** The channel's sections as a labelled `nav` of links, each a route. */
export function ChannelHeaderTabs({ className, children, ...props }: ComponentPropsWithRef<'nav'>) {
  const { layout } = useChannelHeader('Tabs');
  const { channelSections } = useUiCopy();
  const styles = channelHeaderStyles({ layout });

  if (layout === 'identity') {
    return null;
  }

  return (
    <nav
      data-slot="channel-header-tabs"
      aria-label={channelSections}
      className={styles.tabs({ className })}
      {...props}
    >
      <ul className={styles.tabList()}>{children}</ul>
    </nav>
  );
}

export interface ChannelHeaderTabProps extends ComponentPropsWithRef<'a'> {
  /** The section on screen: `aria-current="page"` and the accent underline. */
  active?: boolean;
  /** Styles the router link the caller passes. */
  asChild?: boolean;
}

export function ChannelHeaderTab({
  active = false,
  asChild = false,
  className,
  ...props
}: ChannelHeaderTabProps) {
  const styles = channelHeaderStyles({ layout: useChannelHeader('Tab').layout });
  const Element = asChild ? Slot.Root : 'a';

  return (
    <li className="tw:flex">
      <Element
        data-slot="channel-header-tab"
        aria-current={active ? 'page' : undefined}
        className={styles.tab({ className })}
        {...props}
      />
    </li>
  );
}

export function ChannelHeaderSkeleton({ layout = 'full' }: { layout?: ChannelHeaderLayout }) {
  const styles = channelHeaderStyles({ layout });

  return (
    <div data-slot="channel-header-skeleton" aria-hidden="true" className={styles.root()}>
      {layout === 'full' && (
        <div className={styles.bannerFrame()}>
          <Skeleton
            radius="card"
            className="tw:aspect-[3/1] tw:w-full tw:medium:aspect-[4/1] tw:expanded:aspect-[6/1]"
          />
        </div>
      )}
      <div className={styles.identity()}>
        <Skeleton shape="circle" className={styles.avatar({ className: 'tw:size-avatar-xl' })} />
        <Skeleton
          shape="text"
          className={styles.name({ className: 'tw:w-[17.5rem] tw:max-w-full' })}
        />
        <Skeleton shape="text" className={styles.stats({ className: 'tw:w-[13.75rem]' })} />
        <Skeleton
          shape="text"
          className={styles.bio({ className: 'tw:w-[22.5rem] tw:max-w-full tw:text-body' })}
        />
        <div className={styles.actions()}>
          <Skeleton
            radius="control"
            className="tw:h-control-md tw:w-[7.5rem] tw:max-medium:flex-1"
          />
        </div>
      </div>
      {layout === 'full' && <Skeleton radius="xs" className="tw:h-control-md tw:w-full" />}
    </div>
  );
}
