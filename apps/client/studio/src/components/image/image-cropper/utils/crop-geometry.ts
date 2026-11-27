import { BANNER_ASPECTS, BANNER_TARGETS, type CropRect, type ImageCrops } from '@vp/domain';
import type { ImageCropperKind, ImageCropperTarget } from '../types';

export interface ImageSize {
  width: number;
  height: number;
}

export interface CropView {
  zoom: number;
  centreX: number;
  centreY: number;
}

export const MAX_ZOOM = 4;

const AVATAR_ASPECT = 1;

const SAFE_AREA = { width: 1546, height: 423 };

const SAFE_AREA_REFERENCE_WIDTH = 2560;

const TARGETS = {
  avatar: ['avatar'],
  banner: BANNER_TARGETS,
} as const satisfies Record<ImageCropperKind, readonly ImageCropperTarget[]>;

export function targetsOf(kind: ImageCropperKind): readonly ImageCropperTarget[] {
  return TARGETS[kind];
}

export function aspectOf(target: ImageCropperTarget): number {
  return target === 'avatar' ? AVATAR_ASPECT : BANNER_ASPECTS[target];
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** The frame in whole pixels: the largest of the aspect that fits the image, its sides divided by the zoom. */
function frameSize(size: ImageSize, aspect: number, zoom: number): ImageSize {
  const widthLimited = size.width / size.height <= aspect;
  const largestWidth = widthLimited ? size.width : size.height * aspect;
  const width = clamp(Math.round(largestWidth / zoom), 1, size.width);
  const height = clamp(Math.round(width / aspect), 1, size.height);
  return { width, height };
}

function clampedView(size: ImageSize, aspect: number, view: CropView): CropView {
  const frame = frameSize(size, aspect, view.zoom);
  return {
    zoom: view.zoom,
    centreX: clamp(view.centreX, frame.width / 2, size.width - frame.width / 2),
    centreY: clamp(view.centreY, frame.height / 2, size.height - frame.height / 2),
  };
}

function initialView(size: ImageSize): CropView {
  return { zoom: 1, centreX: size.width / 2, centreY: size.height / 2 };
}

/** Whole pixels of the file, inside it. */
export function cropRect(size: ImageSize, aspect: number, view: CropView): CropRect {
  const { width, height } = frameSize(size, aspect, view.zoom);
  const { centreX, centreY } = clampedView(size, aspect, view);
  return {
    x: clamp(Math.round(centreX - width / 2), 0, size.width - width),
    y: clamp(Math.round(centreY - height / 2), 0, size.height - height),
    width,
    height,
  };
}

export function moveView(
  size: ImageSize,
  aspect: number,
  view: CropView,
  dx: number,
  dy: number
): CropView {
  return clampedView(size, aspect, {
    ...view,
    centreX: view.centreX + dx,
    centreY: view.centreY + dy,
  });
}

export function zoomView(size: ImageSize, aspect: number, view: CropView, zoom: number): CropView {
  return clampedView(size, aspect, { ...view, zoom: clamp(zoom, 1, MAX_ZOOM) });
}

export function initialViews(size: ImageSize): Record<ImageCropperTarget, CropView> {
  const view = initialView(size);
  return { avatar: view, desktop: view, mobile: view, tv: view };
}

export function cropsOf(
  kind: ImageCropperKind,
  size: ImageSize,
  views: Record<ImageCropperTarget, CropView>
): ImageCrops {
  const rect = (target: ImageCropperTarget) => cropRect(size, aspectOf(target), views[target]);
  return kind === 'avatar'
    ? { kind, crop: rect('avatar') }
    : { kind, crops: { desktop: rect('desktop'), mobile: rect('mobile'), tv: rect('tv') } };
}

/** What a 2560 px wide image keeps visible on every screen, as fractions of a frame of this aspect. */
export function safeAreaOf(aspect: number): { width: number; height: number } {
  const frameHeight = SAFE_AREA_REFERENCE_WIDTH / aspect;
  return {
    width: SAFE_AREA.width / SAFE_AREA_REFERENCE_WIDTH,
    height: Math.min(1, SAFE_AREA.height / frameHeight),
  };
}

/** The file shown through a box of the crop's shape: the crop fills it, with no canvas. */
export function previewStyle(rect: CropRect, size: ImageSize) {
  const offset = (cropStart: number, cropLength: number, length: number) =>
    length === cropLength ? 0 : (cropStart / (length - cropLength)) * 100;
  return {
    backgroundSize: `${(size.width / rect.width) * 100}% auto`,
    backgroundPosition: `${offset(rect.x, rect.width, size.width)}% ${offset(rect.y, rect.height, size.height)}%`,
  };
}

/** The crop's place over the image, in percent of the image. */
export function frameBox(rect: CropRect, size: ImageSize) {
  return {
    insetInlineStart: `${(rect.x / size.width) * 100}%`,
    insetBlockStart: `${(rect.y / size.height) * 100}%`,
    inlineSize: `${(rect.width / size.width) * 100}%`,
    blockSize: `${(rect.height / size.height) * 100}%`,
  };
}
