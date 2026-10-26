import { createCompoundContext } from '../../lib/create-compound-context';

export const [DrawerContext, useDrawer] = createCompoundContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>('Drawer');
