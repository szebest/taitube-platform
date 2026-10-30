import { videoTransitionName } from '@vp/components';
import { Button, cn, Icon, Skeleton, Slot, Spinner, useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { StageContext, useStage } from './stage.context';
import { stageStyles } from './stage.variants';
import type { StageStatusKind, StageVariant } from './types';

export interface StageRootProps extends ComponentPropsWithRef<'section'> {
  variant?: StageVariant;
  /** Names the media the shared element a card's thumbnail morphs into. */
  videoId?: string;
  /** One to three sampled CSS colours; without them no glow renders. */
  glowColors?: readonly string[];
  /** Dims the glow while playback is paused. */
  paused?: boolean;
}

/** The black media ground the player sits on, with the ambient glow behind it. */
export function StageRoot({
  variant = 'standard',
  videoId,
  glowColors,
  paused = false,
  className,
  style,
  children,
  ...props
}: StageRootProps) {
  const { videoPlayer } = useUiCopy();
  const styles = stageStyles({ variant });
  const banner = variant === 'banner';
  const transition =
    videoId === undefined || banner
      ? undefined
      : { viewTransitionName: videoTransitionName(videoId) };

  return (
    <StageContext value={{ variant, videoId, glowColors, paused }}>
      <section
        data-slot="stage"
        data-variant={variant}
        data-paused={paused || undefined}
        aria-label={banner ? undefined : videoPlayer}
        className={styles.root({ className })}
        style={{ ...transition, ...style }}
        {...props}
      >
        <div data-slot="stage-ground" aria-hidden="true" className={styles.ground()} />
        {children}
      </section>
    </StageContext>
  );
}

/** The ambient glow, one blurred band per sampled colour, cross-fading as the colours change. */
export function StageGlow({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { glowColors } = useStage('Glow');
  const styles = stageStyles();

  if (!glowColors?.length) return null;

  return (
    <div
      data-slot="stage-glow"
      aria-hidden="true"
      className={styles.glow({ className })}
      {...props}
    >
      {glowColors.map((color, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a band is its position; the colour in it changes
          key={index}
          className={styles.glowColor()}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export interface StagePlayerProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The slot the player fills; Stage owns no controls. */
export function StagePlayer({ asChild = false, className, ...props }: StagePlayerProps) {
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element data-slot="stage-player" className={stageStyles().player({ className })} {...props} />
  );
}

export interface StagePosterProps extends ComponentPropsWithRef<'img'> {
  /** The video title. */
  alt: string;
  asChild?: boolean;
}

/** The poster at its final size, the page's LCP candidate. */
export function StagePoster({ asChild = false, className, ...props }: StagePosterProps) {
  const Element = asChild ? Slot.Root : 'img';

  return (
    <Element data-slot="stage-poster" className={stageStyles().poster({ className })} {...props} />
  );
}

type StageStatusOf<Kind extends StageStatusKind, Extra = object> = Omit<
  ComponentPropsWithRef<'div'>,
  'role'
> & { kind: Kind } & Extra;

export type StageStatusProps =
  | StageStatusOf<'loading'>
  | StageStatusOf<'error', { onRetry?: () => void }>
  | StageStatusOf<'unavailable'>;

/** A cover over the media at the stage's size: a delayed spinner, an error with retry, or unavailable. */
export function StageStatus(props: StageStatusProps) {
  const { retry } = useUiCopy();

  switch (props.kind) {
    case 'loading': {
      const { kind, className, children, ...rest } = props;
      return (
        <div
          data-slot="stage-status"
          data-kind={kind}
          aria-hidden="true"
          className={stageStyles({ kind }).status({ className })}
          {...rest}
        >
          <span className={stageStyles().statusMark()}>
            <Spinner size="md" />
          </span>
          {children}
        </div>
      );
    }
    case 'error': {
      const { kind, onRetry, className, children, ...rest } = props;
      return (
        <div
          data-slot="stage-status"
          data-kind={kind}
          className={stageStyles({ kind }).status({ className })}
          {...rest}
        >
          <span aria-hidden="true" className={stageStyles().statusMark()}>
            <Icon name="alert" size="md" />
          </span>
          <p role="alert" className="tw:m-0 tw:max-w-prose">
            {children}
          </p>
          {onRetry && <Button onClick={onRetry}>{retry}</Button>}
        </div>
      );
    }
    case 'unavailable': {
      const { kind, className, children, ...rest } = props;
      return (
        <div
          data-slot="stage-status"
          data-kind={kind}
          className={stageStyles({ kind }).status({ className })}
          {...rest}
        >
          <span aria-hidden="true" className={stageStyles().statusMark()}>
            <Icon name="eye-off" size="md" />
          </span>
          <p className="tw:m-0 tw:max-w-prose">{children}</p>
        </div>
      );
    }
  }
}

export function StageSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      data-slot="stage-skeleton"
      radius="card"
      className={cn('tw:aspect-video tw:w-full tw:bg-media', className)}
    />
  );
}
