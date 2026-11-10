import { Avatar, Badge, Button, Icon, IconButton, Slot, useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { ChannelHeaderContext, useChannelHeader } from './channel-header.context';
import { channelHeaderStyles } from './channel-header.variants';
import type { ChannelHeaderLayout } from './types';

const AVATAR_SIZES = '(min-width: 600px) 112px, 72px';

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
  /** A `BannerLink`, drawn in the safe area. */
  link?: ReactNode;
}

/** The banner image, or a tint of the sampled colour over `surface` at the same height when there is none. */
export function ChannelHeaderBanner({
  src,
  alt = '',
  asChild = false,
  link,
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
              <div className="size-full" style={{ backgroundColor: glowColor }} />
              <div className={styles.bannerFade()} />
            </div>
          ))}
        {link !== undefined && <div className={styles.bannerSafeArea()}>{link}</div>}
      </div>
    </div>
  );
}

export type ChannelHeaderBannerLinkProps = Omit<ComponentPropsWithRef<'a'>, 'target' | 'rel'>;

/** A small button to a new tab; give it an `https` address only. */
export function ChannelHeaderBannerLink({
  className,
  children,
  ...props
}: ChannelHeaderBannerLinkProps) {
  const styles = channelHeaderStyles({ layout: useChannelHeader('BannerLink').layout });

  return (
    <Button asChild size="sm" variant="soft" className={styles.bannerLink({ className })}>
      <a target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    </Button>
  );
}

export interface ChannelHeaderIdentityProps extends Omit<
  ComponentPropsWithRef<'header'>,
  'children'
> {
  name: string;
  handle: string;
  avatarSrc?: string;
  /** The avatar by width, `"url 48w, url 128w"`. */
  avatarSrcSet?: string;
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
  avatarSrcSet,
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
        {avatarSrc !== undefined && (
          <Avatar.Image
            src={avatarSrc}
            srcSet={avatarSrcSet}
            sizes={avatarSrcSet && AVATAR_SIZES}
            alt=""
          />
        )}
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
    <li className="flex">
      <Element
        data-slot="channel-header-tab"
        aria-current={active ? 'page' : undefined}
        className={styles.tab({ className })}
        {...props}
      />
    </li>
  );
}
