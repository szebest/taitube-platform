import { BANNER_TARGETS, type CropRect } from '@vp/domain';
import { decideImageCrops } from '@vp/domain-rules';
import { isOk } from '@vp/result';
import type { ImageCropperTarget } from '#app/components/image/image-cropper/types';
import {
  MAX_ZOOM,
  type CropView,
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
} from '../crop-geometry';

const LANDSCAPE = { width: 2560, height: 1440 };

describe('apps/client/studio: crop geometry', () => {
  it.each([
    { kind: 'avatar' as const, targets: ['avatar'] },
    { kind: 'banner' as const, targets: ['desktop', 'mobile', 'tv'] },
  ])('offers $targets for a $kind', ({ kind, targets }) => {
    expect(targetsOf(kind)).toEqual(targets);
  });

  it.each([
    { target: 'avatar' as const, aspect: 1 },
    { target: 'desktop' as const, aspect: 6 },
    { target: 'mobile' as const, aspect: 3 },
    { target: 'tv' as const, aspect: 16 / 9 },
  ])('frames $target at $aspect', ({ target, aspect }) => {
    expect(aspectOf(target)).toBe(aspect);
  });

  it.each([
    {
      scenario: 'a wide image, 6:1, unzoomed',
      size: LANDSCAPE,
      aspect: 6,
      zoom: 1,
      frame: { width: 2560, height: 427 },
    },
    {
      scenario: 'a wide image, square, unzoomed',
      size: LANDSCAPE,
      aspect: 1,
      zoom: 1,
      frame: { width: 1440, height: 1440 },
    },
    {
      scenario: 'a tall image, 16:9, unzoomed',
      size: { width: 800, height: 1200 },
      aspect: 16 / 9,
      zoom: 1,
      frame: { width: 800, height: 450 },
    },
    {
      scenario: 'a wide image, square, at 2x',
      size: LANDSCAPE,
      aspect: 1,
      zoom: 2,
      frame: { width: 720, height: 720 },
    },
    {
      scenario: 'a wide image, 3:1, at the most zoom',
      size: LANDSCAPE,
      aspect: 3,
      zoom: MAX_ZOOM,
      frame: { width: 640, height: 213 },
    },
  ])('sizes the frame for $scenario', ({ size, aspect, zoom, frame }) => {
    expect(
      cropRect(size, aspect, { zoom, centreX: size.width / 2, centreY: size.height / 2 })
    ).toMatchObject(frame);
  });

  it.each([
    {
      scenario: 'the centre',
      view: { zoom: 1, centreX: 1280, centreY: 720 },
      rect: { x: 560, y: 0, width: 1440, height: 1440 },
    },
    {
      scenario: 'past the start',
      view: { zoom: 1, centreX: -500, centreY: -500 },
      rect: { x: 0, y: 0, width: 1440, height: 1440 },
    },
    {
      scenario: 'past the end',
      view: { zoom: 2, centreX: 9999, centreY: 9999 },
      rect: { x: 1840, y: 720, width: 720, height: 720 },
    },
    {
      scenario: 'a fractional centre',
      view: { zoom: 2, centreX: 1000.4, centreY: 500.6 },
      rect: { x: 640, y: 141, width: 720, height: 720 },
    },
  ])('cuts a square at $scenario in whole pixels inside the image', ({ view, rect }) => {
    expect(cropRect(LANDSCAPE, 1, view)).toEqual(rect);
  });

  it.each([
    { scenario: 'right', dx: 300, dy: 0, centre: { centreX: 1580, centreY: 720 } },
    { scenario: 'down and left', dx: -200, dy: 400, centre: { centreX: 1080, centreY: 1080 } },
    { scenario: 'past every edge', dx: 99999, dy: -99999, centre: { centreX: 1920, centreY: 360 } },
  ])('moves a 2x view $scenario and keeps its frame inside', ({ dx, dy, centre }) => {
    const view = { zoom: 2, centreX: 1280, centreY: 720 };

    expect(moveView(LANDSCAPE, 16 / 9, view, dx, dy)).toEqual({ zoom: 2, ...centre });
  });

  it.each([
    { zoom: 0.2, expected: 1 },
    { zoom: 2.5, expected: 2.5 },
    { zoom: 40, expected: MAX_ZOOM },
  ])('zooms to $expected when asked for $zoom', ({ zoom, expected }) => {
    expect(zoomView(LANDSCAPE, 1, { zoom: 1, centreX: 1280, centreY: 720 }, zoom).zoom).toBe(
      expected
    );
  });

  it('pulls the centre back inside when a zoom out widens the frame', () => {
    const zoomedIn: CropView = { zoom: 4, centreX: 2400, centreY: 1300 };

    expect(zoomView(LANDSCAPE, 1, zoomedIn, 1)).toEqual({
      zoom: 1,
      centreX: 1840,
      centreY: 720,
    });
  });

  it.each([
    { aspect: 16 / 9, width: 1546 / 2560, height: 423 / 1440 },
    { aspect: 3, width: 1546 / 2560, height: 423 / (2560 / 3) },
    { aspect: 6, width: 1546 / 2560, height: 423 / (2560 / 6) },
    { aspect: 12, width: 1546 / 2560, height: 1 },
  ])('keeps the safe area at $width by $height of a $aspect frame', ({ aspect, width, height }) => {
    expect(safeAreaOf(aspect)).toEqual({ width, height });
  });

  it.each([
    {
      scenario: 'a crop that is the whole image',
      rect: { x: 0, y: 0, width: 2560, height: 1440 },
      style: { backgroundSize: '100% auto', backgroundPosition: '0% 0%' },
    },
    {
      scenario: 'the centre half',
      rect: { x: 640, y: 360, width: 1280, height: 720 },
      style: { backgroundSize: '200% auto', backgroundPosition: '50% 50%' },
    },
    {
      scenario: 'the bottom end corner',
      rect: { x: 1280, y: 720, width: 1280, height: 720 },
      style: { backgroundSize: '200% auto', backgroundPosition: '100% 100%' },
    },
  ])('shows $scenario through a preview box', ({ rect, style }) => {
    expect(previewStyle(rect, LANDSCAPE)).toEqual(style);
  });

  it('places the frame over the image in percent', () => {
    expect(frameBox({ x: 640, y: 360, width: 1280, height: 720 }, LANDSCAPE)).toEqual({
      insetInlineStart: '25%',
      insetBlockStart: '25%',
      inlineSize: '50%',
      blockSize: '50%',
    });
  });
});

const IMAGES = [
  { scenario: 'the smallest banner', size: { width: 1024, height: 576 } },
  { scenario: 'a 2560 x 1440 banner', size: LANDSCAPE },
  { scenario: 'a tall photo', size: { width: 1200, height: 3000 } },
  { scenario: 'an odd size', size: { width: 1777, height: 1013 } },
];

const VIEWS: Record<string, (target: ImageCropperTarget) => CropView> = {
  unzoomed: () => ({ zoom: 1, centreX: 0, centreY: 0 }),
  'zoomed to the far corner': () => ({ zoom: 3.3, centreX: 99999, centreY: 99999 }),
  'zoomed off-centre': () => ({ zoom: 1.7, centreX: 777.7, centreY: 333.3 }),
};

describe('apps/client/studio: crops the API accepts', () => {
  it.each(IMAGES.flatMap((image) => Object.keys(VIEWS).map((view) => ({ ...image, view }))))(
    'gives $scenario, $view, banner crops that decideImageCrops accepts',
    ({ size, view }) => {
      const views = initialViews(size);
      for (const target of BANNER_TARGETS) {
        views[target] = VIEWS[view]?.(target) ?? views[target];
      }

      const crops = cropsOf('banner', size, views);

      expect(isOk(decideImageCrops(crops, size))).toBe(true);
    }
  );

  it.each(
    IMAGES.filter(({ size }) => size.width >= 200).flatMap((image) =>
      Object.keys(VIEWS).map((view) => ({ ...image, view }))
    )
  )('gives $scenario, $view, an avatar crop that decideImageCrops accepts', ({ size, view }) => {
    const crops = cropsOf('avatar', size, {
      ...initialViews(size),
      avatar: VIEWS[view]?.('avatar') ?? initialViews(size).avatar,
    });

    expect(isOk(decideImageCrops(crops, size))).toBe(true);
    expect((crops as { crop: CropRect }).crop.width).toBe(
      (crops as { crop: CropRect }).crop.height
    );
  });
});
