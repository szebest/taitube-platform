import { cn } from '@vp/ui';

type ImageKind = 'avatar' | 'banner';

const LOOKS = {
  avatar: {
    frame: 'w-24 rounded-full',
    ratio: '1 / 1',
    guideWidth: '100%',
    guideShape: 'rounded-full',
  },
  banner: {
    frame: 'w-full rounded-card',
    ratio: '16 / 5',
    guideWidth: '60%',
    guideShape: 'rounded-card',
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
      className={cn('relative overflow-hidden bg-surface', look.frame)}
      style={{ aspectRatio: look.ratio }}
    >
      <img src={src} alt={label} className="size-full object-cover" />
      <div
        data-slot="safe-zone"
        aria-hidden="true"
        className={cn(
          'absolute inset-0 mx-auto border-control border-dashed border-border-strong',
          look.guideShape
        )}
        style={{ width: look.guideWidth }}
      />
    </div>
  );
}
