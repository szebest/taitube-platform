import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { DialogFooter } from '../dialog/dialog';
import { AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './alert-dialog';

export const AlertDialog = {
  Root: AlertDialogPrimitive.Root,
  Trigger: AlertDialogPrimitive.Trigger,
  Content: AlertDialogContent,
  Title: AlertDialogTitle,
  Description: AlertDialogDescription,
  Footer: DialogFooter,
  Cancel: AlertDialogPrimitive.Cancel,
  Action: AlertDialogPrimitive.Action,
};
export type { AlertDialogContentProps } from './alert-dialog';
