import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useSyncExternalStore } from 'react';
import { useMediaQuery } from '../../appearance/media';
import {
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog/dialog';
import {
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
} from '../drawer/drawer';
import { ResponsiveModalContext, useResponsiveModal } from './responsive-modal.context';
import type { ResponsiveModalSize } from './types';

export const COMPACT_QUERY = '(max-width: 599px)';

const noUnsubscribe = () => () => undefined;

export function ResponsiveModalRoot(props: ComponentPropsWithRef<typeof DialogPrimitive.Root>) {
  const compact = useMediaQuery(COMPACT_QUERY);
  const hydrated = useSyncExternalStore(
    noUnsubscribe,
    () => true,
    () => false
  );
  const shared = { compact, inline: !hydrated };
  const Root = compact ? DrawerRoot : DialogPrimitive.Root;

  return (
    <ResponsiveModalContext value={shared}>
      <Root {...props} />
    </ResponsiveModalContext>
  );
}

export interface ResponsiveModalContentProps extends Omit<
  ComponentPropsWithRef<typeof DialogPrimitive.Content>,
  'children'
> {
  size?: ResponsiveModalSize;
  children?: React.ReactNode;
}

export function ResponsiveModalContent({ children, ...props }: ResponsiveModalContentProps) {
  const { compact, inline } = useResponsiveModal('Content');

  return compact ? (
    <DrawerContent inline={inline} {...props}>
      <DrawerHandle />
      {children}
    </DrawerContent>
  ) : (
    <DialogContent inline={inline} {...props}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveModalHeader(props: ComponentPropsWithRef<'div'>) {
  const { compact } = useResponsiveModal('Header');
  const Header = compact ? DrawerHeader : DialogHeader;

  return <Header {...props} />;
}

export function ResponsiveModalTitle(props: ComponentPropsWithRef<typeof DialogPrimitive.Title>) {
  const { compact } = useResponsiveModal('Title');
  const Title = compact ? DrawerTitle : DialogTitle;

  return <Title {...props} />;
}

export function ResponsiveModalDescription(
  props: ComponentPropsWithRef<typeof DialogPrimitive.Description>
) {
  const { compact } = useResponsiveModal('Description');
  const Description = compact ? DrawerDescription : DialogDescription;

  return <Description {...props} />;
}

export function ResponsiveModalBody(props: ComponentPropsWithRef<'div'>) {
  const { compact } = useResponsiveModal('Body');
  const Body = compact ? DrawerBody : DialogBody;

  return <Body {...props} />;
}

export function ResponsiveModalFooter(props: ComponentPropsWithRef<'div'>) {
  const { compact } = useResponsiveModal('Footer');
  const Footer = compact ? DrawerFooter : DialogFooter;

  return <Footer {...props} />;
}
