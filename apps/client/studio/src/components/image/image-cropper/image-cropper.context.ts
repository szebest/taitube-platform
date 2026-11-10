import type { CropRect } from '@vp/domain';
import { createCompoundContext } from '@vp/ui';
import type { ImageCropperKind, ImageCropperStatus, ImageCropperTarget } from './types';
import type { CropView, ImageSize } from './utils/crop-geometry';

export interface ImageCropperState {
  kind: ImageCropperKind;
  src: string;
  size: ImageSize;
  status: ImageCropperStatus;
  /** True while the job runs or is done: the framing is no longer the creator's to change. */
  locked: boolean;
  targets: readonly ImageCropperTarget[];
  target: ImageCropperTarget;
  selectTarget: (target: ImageCropperTarget) => void;
  view: CropView;
  rectOf: (target: ImageCropperTarget) => CropRect;
  moveBy: (dx: number, dy: number) => void;
  zoomTo: (zoom: number) => void;
  confirm: () => void;
}

export const [ImageCropperContext, useImageCropper] =
  createCompoundContext<ImageCropperState>('ImageCropper');
