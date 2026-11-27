import { type ComponentPropsWithRef, useEffect, useRef, useState } from 'react';
import { useAmbientGlowState } from '#app/lib/ambient/ambient-glow';
import { ambientLayerStyles } from './ambient-layer.variants';

type Box = Readonly<{ left: number; top: number; width: number; height: number }>;

/**
 * The glow behind the page, on the `ambient` layer: below the header, the rail and the content, above the page
 * ground, clipped by the page and not the stage. It is sized from the stage's box (a quarter of it past each
 * edge), so it reaches under the sticky header and the rail.
 */
export function AmbientLayer({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { glow } = useAmbientGlowState();
  const layer = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>();
  const styles = ambientLayerStyles();

  useEffect(() => {
    const container = layer.current;
    if (container === null || glow === undefined) {
      setBox(undefined);
      return;
    }

    const measure = () => {
      const page = container.getBoundingClientRect();
      const { left, top, width, height } = glow.stage.getBoundingClientRect();
      setBox({ left: left - page.left, top: top - page.top, width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(glow.stage);
    observer.observe(container);
    const stopMeasuring = () => observer.disconnect();
    return stopMeasuring;
  }, [glow]);

  return (
    <div
      ref={layer}
      data-slot="ambient-layer"
      aria-hidden="true"
      className={styles.layer({ className })}
      {...props}
    >
      {glow !== undefined && box !== undefined && (
        <div data-slot="ambient-stage" className={styles.stage()} style={box}>
          <div className={styles.glow()}>
            {glow.colors.map((color, index) => (
              <span
                // oxlint-disable-next-line react/no-array-index-key -- a band is its position; the colour in it changes
                key={index}
                className={styles.color()}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
