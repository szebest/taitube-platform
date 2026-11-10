import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ImageCrops } from '@vp/domain';
import { decideImageCrops } from '@vp/domain-rules';
import { isOk } from '@vp/result';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { ImageCropper, type ImageCropperKind, type ImageCropperStatus } from '../index';

const SIZE = { width: 2560, height: 1440 };

const LABELS = { avatar: 'Picture', desktop: 'Desktop', mobile: 'Mobile', tv: 'TV' };

interface RenderOptions {
  kind?: ImageCropperKind;
  status?: ImageCropperStatus;
}

function renderCropper({ kind = 'banner', status = 'editing' }: RenderOptions = {}) {
  const onConfirm = vi.fn<(crops: ImageCrops) => void>();
  const onOpenChange = vi.fn();
  render(
    <ImageCropper.Root
      kind={kind}
      src="blob:local"
      size={SIZE}
      status={status}
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    >
      <ImageCropper.Title>Frame your image</ImageCropper.Title>
      <ImageCropper.Description>Move and zoom the frame.</ImageCropper.Description>
      <ImageCropper.Targets
        aria-label="Screen"
        labels={{ desktop: 'Desktop', mobile: 'Mobile', tv: 'TV' }}
      />
      <ImageCropper.Stage label="Crop area" />
      <ImageCropper.Zoom label="Zoom" />
      <ImageCropper.Previews labels={LABELS} />
      <ImageCropper.Status label="Processing" />
      <ImageCropper.Cancel>Cancel</ImageCropper.Cancel>
      <ImageCropper.Confirm>Use image</ImageCropper.Confirm>
    </ImageCropper.Root>,
    { wrapper: AppProviders }
  );
  return { onConfirm, onOpenChange };
}

const frame = () => screen.getByRole('group', { name: 'Crop area' });

function pressOn(key: string, init: { shiftKey?: boolean } = {}) {
  fireEvent.keyDown(frame(), { key, ...init });
}

function confirmedCrops({ onConfirm }: ReturnType<typeof renderCropper>): ImageCrops {
  fireEvent.click(screen.getByRole('button', { name: 'Use image' }));
  const [crops] = onConfirm.mock.lastCall ?? [];
  if (!crops) throw new Error('Nothing was confirmed');
  return crops;
}

describe('ImageCropper', () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 360,
    } as DOMRect);
  });

  it('starts every banner target on the centre of the whole image and hands them back', () => {
    const crops = confirmedCrops(renderCropper());

    expect(crops).toEqual({
      kind: 'banner',
      crops: {
        desktop: { x: 0, y: 507, width: 2560, height: 427 },
        mobile: { x: 0, y: 294, width: 2560, height: 853 },
        tv: { x: 0, y: 0, width: 2560, height: 1440 },
      },
    });
    expect(isOk(decideImageCrops(crops, SIZE))).toBe(true);
  });

  it('crops an avatar to one square and offers no target choice', () => {
    const rendered = renderCropper({ kind: 'avatar' });

    expect(screen.queryByRole('radiogroup', { name: 'Screen' })).toBeNull();
    expect(confirmedCrops(rendered)).toEqual({
      kind: 'avatar',
      crop: { x: 560, y: 0, width: 1440, height: 1440 },
    });
  });

  it('moves the frame of the active target with the arrow keys and leaves the others', () => {
    const rendered = renderCropper();

    fireEvent.click(screen.getByRole('radio', { name: 'Mobile' }));
    pressOn('ArrowDown');
    pressOn('ArrowDown', { shiftKey: true });

    const crops = confirmedCrops(rendered);
    expect(crops.kind === 'banner' && crops.crops.mobile.y).toBe(549);
    expect(crops.kind === 'banner' && crops.crops.desktop.y).toBe(507);
  });

  it('keeps a frame inside the image however far it is pushed', () => {
    const rendered = renderCropper({ kind: 'avatar' });

    for (let press = 0; press < 40; press += 1) pressOn('ArrowRight', { shiftKey: true });

    expect(confirmedCrops(rendered)).toEqual({
      kind: 'avatar',
      crop: { x: 1120, y: 0, width: 1440, height: 1440 },
    });
  });

  it('moves the frame by the pointer travel, scaled from the screen to the file', () => {
    const rendered = renderCropper({ kind: 'avatar' });

    fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 100, clientY: 0 });
    fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 90, clientY: 0 });
    fireEvent.pointerUp(frame(), { pointerId: 1 });
    fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 10, clientY: 0 });

    expect(confirmedCrops(rendered)).toEqual({
      kind: 'avatar',
      crop: { x: 560 - 40, y: 0, width: 1440, height: 1440 },
    });
  });

  it('zooms the active target into a smaller frame', () => {
    const rendered = renderCropper({ kind: 'avatar' });

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Zoom' }), { key: 'End' });

    expect(confirmedCrops(rendered)).toEqual({
      kind: 'avatar',
      crop: { x: 1100, y: 540, width: 360, height: 360 },
    });
  });

  it.each([
    { target: 'desktop', box: 6 },
    { target: 'mobile', box: 3 },
    { target: 'tv', box: 16 / 9 },
  ])('draws a $target preview of the target shape from the local file', ({ target, box }) => {
    renderCropper();

    const preview = document.querySelector(
      `[data-slot="image-cropper-preview"][data-target="${target}"]`
    );

    expect(preview).toHaveStyle({ aspectRatio: String(box), backgroundImage: 'url("blob:local")' });
  });

  it('draws the safe-area guide on a banner only', () => {
    renderCropper();

    expect(document.querySelectorAll('[data-slot="image-cropper-guide"]')).toHaveLength(1);
  });

  it('draws no safe-area guide on an avatar', () => {
    renderCropper({ kind: 'avatar' });

    expect(document.querySelector('[data-slot="image-cropper-guide"]')).toBeNull();
  });

  it.each([
    { status: 'queued' as const, role: 'status', indeterminate: true },
    { status: 'ready' as const, role: 'status', indeterminate: false },
  ])(
    'shows the $status job as a progress bar and locks the framing',
    ({ status, indeterminate }) => {
      renderCropper({ status });

      const bar = screen.getByRole('progressbar', { name: 'Processing' });
      expect(bar.hasAttribute('aria-valuenow')).toBe(!indeterminate);
      expect(screen.getByRole('button', { name: 'Use image' })).toBeDisabled();
      expect(frame()).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveAttribute('data-disabled');
    }
  );

  it('says a failed job failed and lets the creator confirm again', () => {
    renderCropper({ status: 'failed' });

    expect(screen.getByRole('alert')).toHaveTextContent('Processing');
    expect(screen.getByRole('button', { name: 'Use image' })).toBeEnabled();
  });

  it('shows no job while editing', () => {
    renderCropper();

    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('closes from Cancel', () => {
    const { onOpenChange } = renderCropper();

    act(() => screen.getByRole('button', { name: 'Cancel' }).click());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('passes axe', async () => {
    renderCropper();

    expect(await axeViolations()).toEqual([]);
  });
});
