import {
  ImageCropperCancel,
  ImageCropperConfirm,
  ImageCropperDescription,
  ImageCropperPreviews,
  ImageCropperProgress,
  ImageCropperRoot,
  ImageCropperStage,
  ImageCropperTargets,
  ImageCropperTitle,
  ImageCropperZoom,
} from './image-cropper';

export const ImageCropper = {
  Root: ImageCropperRoot,
  Title: ImageCropperTitle,
  Description: ImageCropperDescription,
  Targets: ImageCropperTargets,
  Stage: ImageCropperStage,
  Zoom: ImageCropperZoom,
  Previews: ImageCropperPreviews,
  Status: ImageCropperProgress,
  Cancel: ImageCropperCancel,
  Confirm: ImageCropperConfirm,
};
export type { ImageCropperRootProps, ImageCropperTargetsProps } from './image-cropper';
export { useImageCropper } from './image-cropper.context';
export type { ImageCropperKind, ImageCropperStatus, ImageCropperTarget } from './types';
