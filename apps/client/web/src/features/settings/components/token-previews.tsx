import { useT } from '@vp/intl-react';
import { cn } from '@vp/ui';
import { useEffect, useState } from 'react';

const CARD =
  'rounded-card border-divider border-border bg-raised px-inset-control py-inline text-caption text-fg';

export function RadiusPreview() {
  const { tOr } = useT();

  return (
    <div className="flex items-center gap-inline">
      <span className="inline-flex h-control-sm items-center rounded-control bg-accent px-inset-control text-label text-on-accent">
        {tOr('settings.previewButton', {}, '')}
      </span>
      <span className={CARD}>{tOr('settings.previewCard', {}, '')}</span>
    </div>
  );
}

export function TextPreview() {
  const { tOr } = useT();

  return (
    <div className="flex flex-col gap-1 text-fg">
      <span className="text-title">{tOr('settings.previewVideo', {}, '')}</span>
      <p className="m-0 text-body">{tOr('settings.previewText', {}, '')}</p>
    </div>
  );
}

export function SpacingPreview() {
  return (
    <div className="flex flex-col gap-stack rounded-card bg-tint p-inset-card">
      {[0, 1, 2].map((bar) => (
        <span key={bar} className="h-2 rounded-chip bg-tint-strong" />
      ))}
    </div>
  );
}

export function SizingPreview() {
  return (
    <div className="flex items-center gap-inline">
      <span className="size-avatar-md rounded-full bg-tint-strong" />
      <span className="h-control-md w-16 rounded-control bg-tint-strong" />
      <span className="size-icon-md rounded-xs bg-fg-muted" />
    </div>
  );
}

export function BorderPreview() {
  return (
    <div className="flex flex-col gap-inline">
      <span className="h-5 rounded-control border-divider border-border" />
      <span className="h-5 rounded-control border-control border-border-strong" />
    </div>
  );
}

export function ShadowPreview() {
  return (
    <div className="flex flex-col gap-stack p-1">
      {['shadow-1', 'shadow-2', 'shadow-3'].map((elevation) => (
        <span key={elevation} className={cn('h-4 rounded-card bg-raised', elevation)} />
      ))}
    </div>
  );
}

export function AmbientPreview() {
  return (
    <div className="relative isolate p-3">
      <span className="absolute inset-1 -z-10 rounded-card bg-accent opacity-ambient blur-ambient in-data-[ambient=off]:hidden" />
      <span className="block h-8 rounded-card border-divider border-border bg-surface" />
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
    <div className="flex h-8 items-center">
      <span
        className={cn(
          'size-5 rounded-full bg-accent transition-[margin-inline-start] duration-slow ease-standard motion-reduce:transition-none',
          atEnd ? 'ms-[calc(100%-1.25rem)]' : 'ms-0'
        )}
      />
    </div>
  );
}
