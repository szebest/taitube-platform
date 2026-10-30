import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalRoot,
  ResponsiveModalTitle,
} from './responsive-modal';

export const ResponsiveModal = {
  Root: ResponsiveModalRoot,
  Content: ResponsiveModalContent,
  Title: ResponsiveModalTitle,
  Description: ResponsiveModalDescription,
  Body: ResponsiveModalBody,
  Footer: ResponsiveModalFooter,
  Close: DialogPrimitive.Close,
};
export type { ResponsiveModalContentProps } from './responsive-modal';
export { COMPACT_QUERY } from './responsive-modal';
export { useResponsiveModal } from './responsive-modal.context';
export type { ResponsiveModalSize } from './types';
