import { tv } from '@vp/ui';

export const ambientLayerStyles = tv({
  slots: {
    layer:
      'pointer-events-none absolute inset-0 z-ambient hidden overflow-clip medium:block in-data-[ambient=off]:hidden in-data-[contrast=more]:hidden',
    stage: 'absolute',
    glow: 'absolute -inset-x-1/4 -inset-y-1/4 flex blur-ambient opacity-ambient transition-opacity duration-slow ease-standard starting:opacity-0',
    color: 'flex-1 transition-colors duration-slow ease-standard',
  },
});
