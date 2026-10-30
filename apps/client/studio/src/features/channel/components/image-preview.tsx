import { cn } from '@vp/ui';

type ImageKind = 'avatar' | 'banner';

const LOOKS = {
  avatar: {
    frame: 'tw:w-24 tw:rounded-full',
    ratio: '1 / 1',
    guideWidth: '100%',
    guideShape: 'tw:rounded-full',
  },
  banner: {
    frame: 'tw:w-full tw:rounded-card',
    ratio: '16 / 5',
    guideWidth: '60%',
    guideShape: 'tw:rounded-card',
  },
} as const satisfies Record<ImageKind, object>;

interface ImagePreviewProps {
  kind: ImageKind;
  src: string;
  label: string;
}

/** The picture as viewers see its frame, with the guide of what stays visible on every screen. */
export function ImagePreview({ kind, src, label }: ImagePreviewProps) {
  const look = LOOKS[kind];

  return (
    <div
      data-slot="image-preview"
      data-kind={kind}
      className={cn('tw:relative tw:overflow-hidden tw:bg-surface', look.frame)}
      style={{ aspectRatio: look.ratio }}
    >
      <img src={src} alt={label} className="tw:size-full tw:object-cover" />
      <div
        data-slot="safe-zone"
        aria-hidden="true"
        className={cn(
          'tw:absolute tw:inset-0 tw:mx-auto tw:border-control tw:border-dashed tw:border-border-strong',
          look.guideShape
        )}
        style={{ width: look.guideWidth }}
      />
    </div>
  );
}
