import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerRoot,
  DrawerTitle,
} from './drawer';

export const Drawer = {
  Root: DrawerRoot,
  Trigger: DialogPrimitive.Trigger,
  Content: DrawerContent,
  Handle: DrawerHandle,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Close: DialogPrimitive.Close,
};
export type { DrawerContentProps } from './drawer';
export { useDrawer } from './drawer.context';
export { drawerStyles } from './drawer.variants';
export type { DrawerSize } from './types';
