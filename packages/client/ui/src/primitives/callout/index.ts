import { CalloutAction, CalloutBody, CalloutIcon, CalloutRoot, CalloutTitle } from './callout';

export const Callout = {
  Root: CalloutRoot,
  Icon: CalloutIcon,
  Title: CalloutTitle,
  Body: CalloutBody,
  Action: CalloutAction,
};
export type { CalloutIconProps, CalloutPartProps, CalloutRootProps } from './callout';
export { useCallout } from './callout.context';
export { calloutStyles } from './callout.variants';
export type { CalloutFill, CalloutTone } from './types';
