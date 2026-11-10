import { dt } from '../define';

export const studioImages = {
  imagesTitle: dt('Picture and banner'),
  imagesDescription: dt(
    'JPEG, PNG or WebP. A picture is up to 2 MB and at least 200 x 200 px; a banner is up to 6 MB and at least 1024 x 576 px. You frame each one before it is saved.'
  ),
  avatarDrop: dt('Drop a picture here, or click to choose one'),
  bannerDrop: dt('Drop a banner here, or click to choose one'),
  avatarRemove: dt('Remove picture'),
  bannerRemove: dt('Remove banner'),
  avatarPreview: dt('Picture preview'),
  bannerPreview: dt('Banner preview'),
  avatarSafeZone: dt('Shown as a circle: keep faces and text inside the guide.'),
  bannerSafeZone: dt('Phones show only the centre band: keep text inside the guide.'),
  imageTooSmall: dt('This image is too small: it must be at least {minWidth} x {minHeight} px.'),
  imageUnreadable: dt('This file could not be read as an image.'),
  cropAvatarTitle: dt('Frame your picture'),
  cropBannerTitle: dt('Frame your banner'),
  cropAvatarDescription: dt(
    'Drag the frame, or use the arrow keys, to choose what the circle shows.'
  ),
  cropBannerDescription: dt(
    'Frame the banner for each screen. The dashed guide stays visible on every screen.'
  ),
  cropScreen: dt('Screen'),
  cropDesktop: dt('Desktop'),
  cropMobile: dt('Mobile'),
  cropTv: dt('TV'),
  cropPicture: dt('Picture'),
  cropArea: dt('Crop area. Move it with the arrow keys.'),
  cropZoom: dt('Zoom'),
  cropUse: dt('Use this image'),
  cropCancel: dt('Cancel'),
  cropDone: dt('Done'),
  cropWorking: dt('Uploading and processing your image'),
  cropReady: dt('Your image is saved'),
  cropFailed: dt('The image could not be saved. Choose another file, or try again.'),
};
