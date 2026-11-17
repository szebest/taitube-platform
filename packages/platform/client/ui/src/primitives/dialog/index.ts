import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

export const Dialog = {
  Root: DialogPrimitive.Root,
  Trigger: DialogPrimitive.Trigger,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Body: DialogBody,
  Footer: DialogFooter,
  Close: DialogPrimitive.Close,
};
export type { DialogContentProps } from './dialog';
export { useDialog } from './dialog.context';
export { dialogStyles } from './dialog.variants';
export type { DialogSide, DialogSize } from './types';
