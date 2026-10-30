import { useT } from '@vp/intl-react';
import { cn } from '@vp/ui';
import { useEffect, useState } from 'react';

const CARD =
  'tw:rounded-card tw:border-divider tw:border-border tw:bg-raised tw:px-inset-control tw:py-inline tw:text-caption tw:text-fg';

export function RadiusPreview() {
  const { tOr } = useT();

  return (
    <div className="tw:flex tw:items-center tw:gap-inline">
      <span className="tw:inline-flex tw:h-control-sm tw:items-center tw:rounded-control tw:bg-accent tw:px-inset-control tw:text-label tw:text-on-accent">
        {tOr('settings.previewButton', {}, '')}
      </span>
      <span className={CARD}>{tOr('settings.previewCard', {}, '')}</span>
    </div>
  );
}

export function TextPreview() {
  const { tOr } = useT();

  return (
    <div className="tw:flex tw:flex-col tw:gap-1 tw:text-fg">
      <span className="tw:text-title">{tOr('settings.previewVideo', {}, '')}</span>
      <p className="tw:m-0 tw:text-body">{tOr('settings.previewText', {}, '')}</p>
    </div>
  );
}

export function SpacingPreview() {
  return (
    <div className="tw:flex tw:flex-col tw:gap-stack tw:rounded-card tw:bg-tint tw:p-inset-card">
      {[0, 1, 2].map((bar) => (
        <span key={bar} className="tw:h-2 tw:rounded-chip tw:bg-tint-strong" />
      ))}
    </div>
  );
}

export function SizingPreview() {
  return (
    <div className="tw:flex tw:items-center tw:gap-inline">
      <span className="tw:size-avatar-md tw:rounded-full tw:bg-tint-strong" />
      <span className="tw:h-control-md tw:w-16 tw:rounded-control tw:bg-tint-strong" />
      <span className="tw:size-icon-md tw:rounded-xs tw:bg-fg-muted" />
    </div>
  );
}

export function BorderPreview() {
  return (
    <div className="tw:flex tw:flex-col tw:gap-inline">
      <span className="tw:h-5 tw:rounded-control tw:border-divider tw:border-border" />
      <span className="tw:h-5 tw:rounded-control tw:border-control tw:border-border-strong" />
    </div>
  );
}

export function ShadowPreview() {
  return (
    <div className="tw:flex tw:flex-col tw:gap-stack tw:p-1">
      {['tw:shadow-1', 'tw:shadow-2', 'tw:shadow-3'].map((elevation) => (
        <span key={elevation} className={cn('tw:h-4 tw:rounded-card tw:bg-raised', elevation)} />
      ))}
    </div>
  );
}

export function AmbientPreview() {
  return (
    <div className="tw:relative tw:isolate tw:p-3">
      <span className="tw:absolute tw:inset-1 tw:-z-10 tw:rounded-card tw:bg-accent tw:opacity-ambient tw:blur-ambient tw:in-data-[ambient=off]:hidden" />
      <span className="tw:block tw:h-8 tw:rounded-card tw:border-divider tw:border-border tw:bg-surface" />
    </div>
  );
}

const CHIP_SWAP_MS = 1400;

export function MotionPreview() {
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setAtEnd((current) => !current), CHIP_SWAP_MS);
    const stop = () => clearInterval(timer);
    return stop;
  }, []);

  return (
    <div className="tw:flex tw:h-8 tw:items-center">
      <span
        className={cn(
          'tw:size-5 tw:rounded-full tw:bg-accent tw:transition-[margin-inline-start] tw:duration-slow tw:ease-standard tw:motion-reduce:transition-none',
          atEnd ? 'tw:ms-[calc(100%-1.25rem)]' : 'tw:ms-0'
        )}
      />
    </div>
  );
}
