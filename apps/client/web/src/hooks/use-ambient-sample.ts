import { tryCatch, unwrapOr } from '@vp/result';
import { useEffect, useState } from 'react';

const BANDS = 3;
const CHANNELS = 4;
const FRAMES_PER_SECOND = 12;
const FRAME_MS = 1000 / FRAMES_PER_SECOND;
const SMOOTHING = 0.25;

type Rgb = readonly [number, number, number];

/** What to sample: a poster's URL, or a video element, sampled while it plays. */
export type AmbientSource = string | HTMLVideoElement;

/** One colour per vertical third, start to end: the frame drawn three pixels wide averages each. */
function sampleBands(context: CanvasRenderingContext2D, drawable: CanvasImageSource): Rgb[] {
  context.drawImage(drawable, 0, 0, BANDS, 1);
  const pixels = unwrapOr(
    tryCatch(
      (): Uint8ClampedArray | undefined => context.getImageData(0, 0, BANDS, 1).data,
      () => undefined
    ),
    undefined
  );
  if (pixels === undefined) return [];

  return Array.from({ length: BANDS }, (_, band): Rgb => {
    const at = band * CHANNELS;
    return [pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0];
  });
}

const mix = (from: number, to: number) => from + (to - from) * SMOOTHING;

function smooth(previous: Rgb[], next: Rgb[]): Rgb[] {
  return next.map(([red, green, blue], band): Rgb => {
    const before = previous[band];
    return before
      ? [mix(before[0], red), mix(before[1], green), mix(before[2], blue)]
      : [red, green, blue];
  });
}

const toCss = ([red, green, blue]: Rgb) =>
  `rgb(${Math.round(red)} ${Math.round(green)} ${Math.round(blue)})`;

/**
 * Up to three CSS colours from a poster or a playing video, start to end, for an ambient glow. A
 * video is sampled 12 times a second and smoothed; under reduced motion its first sample stays. Empty
 * on the server, and until a frame can be read (a cross-origin image without CORS never can).
 */
export function useAmbientSample(source: AmbientSource | undefined): string[] {
  const [colours, setColours] = useState<string[]>([]);

  useEffect(() => {
    setColours([]);
    if (source === undefined) return;

    const canvas = document.createElement('canvas');
    canvas.width = BANDS;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) return;
    context.imageSmoothingQuality = 'high';

    let shown: Rgb[] = [];
    const show = (bands: Rgb[]) => {
      if (bands.length === 0) return;
      shown = smooth(shown, bands);
      setColours(shown.map(toCss));
    };

    if (typeof source === 'string') {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => show(sampleBands(context, image));
      image.src = source;
      return () => {
        image.onload = null;
      };
    }

    const reduced = document.documentElement.dataset.motion === 'reduced';
    let frame = 0;
    let sampledAt = Number.NEGATIVE_INFINITY;
    const tick = (now: number) => {
      const ready = source.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      if (ready && now - sampledAt >= FRAME_MS) {
        sampledAt = now;
        show(sampleBands(context, source));
        if (reduced && shown.length > 0) return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [source]);

  return colours;
}
