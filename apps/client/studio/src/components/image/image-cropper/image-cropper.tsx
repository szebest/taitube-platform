import type { CropRect, ImageCrops } from '@vp/domain';
import { Button, Callout, cn, Dialog, Progress, SegmentedControl, Slider } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type PointerEvent,
  type PropsWithChildren,
  useRef,
  useState,
} from 'react';
import { ImageCropperContext, useImageCropper } from './image-cropper.context';
import type { ImageCropperKind, ImageCropperStatus, ImageCropperTarget } from './types';
import {
  MAX_ZOOM,
  type ImageSize,
  aspectOf,
  cropRect,
  cropsOf,
  frameBox,
  initialViews,
  moveView,
  previewStyle,
  safeAreaOf,
  targetsOf,
  zoomView,
} from './utils/crop-geometry';

const ZOOM_STEP = 0.05;

export interface ImageCropperRootProps {
  kind: ImageCropperKind;
  /** A local object URL of the chosen file. */
  src: string;
  /** The decoded pixels of that file. */
  size: ImageSize;
  status?: ImageCropperStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (crops: ImageCrops) => void;
}

/** Key it by the file: a new file starts every target from the whole image. */
export function ImageCropperRoot({
  kind,
  src,
  size,
  status = 'editing',
  open,
  onOpenChange,
  onConfirm,
  children,
}: PropsWithChildren<ImageCropperRootProps>) {
  const targets = targetsOf(kind);
  const [target, setTarget] = useState<ImageCropperTarget>(
    kind === 'avatar' ? 'avatar' : 'desktop'
  );
  const [views, setViews] = useState(() => initialViews(size));
  const view = views[target];
  const aspect = aspectOf(target);
  const update = (next: typeof view) => setViews((current) => ({ ...current, [target]: next }));

  return (
    <ImageCropperContext
      value={{
        kind,
        src,
        size,
        status,
        locked: status === 'queued' || status === 'ready',
        targets,
        target,
        selectTarget: setTarget,
        view,
        rectOf: (of) => cropRect(size, aspectOf(of), views[of]),
        moveBy: (dx, dy) => update(moveView(size, aspect, view, dx, dy)),
        zoomTo: (zoom) => update(zoomView(size, aspect, view, zoom)),
        confirm: () => onConfirm(cropsOf(kind, size, views)),
      }}
    >
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content size="lg" data-slot="image-cropper" className="flex flex-col gap-stack">
          {children}
        </Dialog.Content>
      </Dialog.Root>
    </ImageCropperContext>
  );
}

export function ImageCropperTitle(props: ComponentPropsWithRef<typeof Dialog.Title>) {
  return <Dialog.Title {...props} />;
}

export function ImageCropperDescription(props: ComponentPropsWithRef<typeof Dialog.Description>) {
  return <Dialog.Description {...props} />;
}

export interface ImageCropperTargetsProps {
  labels: Record<Exclude<ImageCropperTarget, 'avatar'>, string>;
  'aria-label': string;
}

export function ImageCropperTargets({ labels, 'aria-label': label }: ImageCropperTargetsProps) {
  const { targets, target, selectTarget, locked } = useImageCropper('Targets');

  if (targets.length < 2) return null;
  return (
    <SegmentedControl.Root
      aria-label={label}
      value={target}
      disabled={locked}
      onValueChange={(next) => {
        const chosen = targets.find((each) => each === next);
        if (chosen) selectTarget(chosen);
      }}
    >
      {targets.map(
        (each) =>
          each !== 'avatar' && (
            <SegmentedControl.Item key={each} value={each}>
              {labels[each]}
            </SegmentedControl.Item>
          )
      )}
    </SegmentedControl.Root>
  );
}

export function ImageCropperZoom({ label }: { label: string }) {
  const { view, zoomTo, locked } = useImageCropper('Zoom');

  return (
    <Slider.Root
      min={1}
      max={MAX_ZOOM}
      step={ZOOM_STEP}
      value={[view.zoom]}
      disabled={locked}
      onValueChange={([zoom]) => zoom !== undefined && zoomTo(zoom)}
    >
      <Slider.Thumb aria-label={label} />
    </Slider.Root>
  );
}

export function ImageCropperProgress({ label }: { label: string }) {
  const { status } = useImageCropper('Status');

  if (status === 'editing') return null;
  if (status === 'failed') {
    return (
      <Callout.Root tone="danger" role="alert">
        <Callout.Icon />
        <Callout.Body>{label}</Callout.Body>
      </Callout.Root>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-inline text-body-sm text-fg-muted">
      <Progress aria-label={label} value={status === 'ready' ? 1 : undefined} max={1} />
      <p>{label}</p>
    </div>
  );
}

export function ImageCropperCancel(props: ComponentPropsWithRef<typeof Button>) {
  return (
    <Dialog.Close asChild>
      <Button variant="ghost" {...props} />
    </Dialog.Close>
  );
}

export function ImageCropperConfirm(props: ComponentPropsWithRef<typeof Button>) {
  const { confirm, locked } = useImageCropper('Confirm');

  return <Button disabled={locked} onClick={confirm} {...props} />;
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const NUDGE = 0.05;

const NUDGE_FAST = 0.25;

function outsideFrame({ x, y, width, height }: CropRect, size: ImageSize): string {
  const [left, top] = [(x / size.width) * 100, (y / size.height) * 100];
  const [right, bottom] = [((x + width) / size.width) * 100, ((y + height) / size.height) * 100];
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left}% ${top}%, ${left}% ${bottom}%, ${right}% ${bottom}%, ${right}% ${top}%, ${left}% ${top}%)`;
}

/** The whole image with the active target's frame lit; drag the frame or use the arrow keys. */
export function ImageCropperStage({ label }: { label: string }) {
  const { kind, src, size, target, rectOf, moveBy, locked } = useImageCropper('Stage');
  const stage = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const rect = rectOf(target);
  const guide = kind === 'banner' ? safeAreaOf(aspectOf(target)) : undefined;

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = { x: event.clientX, y: event.clientY };
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current;
    const shown = stage.current?.getBoundingClientRect().width;
    if (!(from && shown)) return;
    const pixelsPerPoint = size.width / shown;
    moveBy((event.clientX - from.x) * pixelsPerPoint, (event.clientY - from.y) * pixelsPerPoint);
    dragFrom.current = { x: event.clientX, y: event.clientY };
  };
  const endDrag = () => {
    dragFrom.current = null;
  };
  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const arrow = ARROWS[event.key];
    if (!arrow || locked) return;
    event.preventDefault();
    const step = event.shiftKey ? NUDGE_FAST : NUDGE;
    moveBy(arrow[0] * rect.width * step, arrow[1] * rect.height * step);
  };

  return (
    <div
      ref={stage}
      dir="ltr"
      data-slot="image-cropper-stage"
      className="relative mx-auto w-full touch-none select-none overflow-hidden rounded-card bg-tint"
      style={{
        aspectRatio: size.width / size.height,
        maxInlineSize: `calc(60vh * ${size.width / size.height})`,
      }}
    >
      <img src={src} alt="" draggable={false} className="block size-full" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-scrim"
        style={{ clipPath: outsideFrame(rect, size) }}
      />
      <div
        role="group"
        aria-label={label}
        tabIndex={locked ? -1 : 0}
        data-slot="image-cropper-frame"
        className="absolute cursor-grab border-control border-solid border-fg focus-ring active:cursor-grabbing"
        style={frameBox(rect, size)}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={nudge}
      >
        {guide && (
          <div
            aria-hidden="true"
            data-slot="image-cropper-guide"
            className="absolute inset-0 m-auto border-control border-dashed border-border-strong"
            style={{
              inlineSize: `${guide.width * 100}%`,
              blockSize: `${guide.height * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function ImageCropperPreviews({ labels }: { labels: Record<ImageCropperTarget, string> }) {
  const { kind, src, size, targets, rectOf } = useImageCropper('Previews');

  return (
    <div
      aria-hidden="true"
      data-slot="image-cropper-previews"
      className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] items-end gap-stack"
    >
      {targets.map((each) => (
        <figure key={each} className="m-0 flex flex-col gap-inline">
          <div
            data-slot="image-cropper-preview"
            data-target={each}
            className={cn(
              'w-full bg-tint bg-no-repeat',
              kind === 'avatar' ? 'size-24 rounded-full' : 'rounded-card'
            )}
            style={{
              aspectRatio: aspectOf(each),
              backgroundImage: `url("${src}")`,
              ...previewStyle(rectOf(each), size),
            }}
          />
          <figcaption className="text-body-sm text-fg-muted">{labels[each]}</figcaption>
        </figure>
      ))}
    </div>
  );
}
