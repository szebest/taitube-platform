import {
  AppShellGroup,
  AppShellMain,
  AppShellNowPlaying,
  AppShellRail,
  AppShellRoot,
  AppShellTabBar,
} from './app-shell';
import { AppShellHeader, AppShellSearchTrigger } from './app-shell-header';
import { AppShellItem, AppShellLabel, AppShellTabItem } from './app-shell-item';

export const AppShell = {
  Root: AppShellRoot,
  Header: AppShellHeader,
  SearchTrigger: AppShellSearchTrigger,
  Rail: AppShellRail,
  Group: AppShellGroup,
  Item: AppShellItem,
  Label: AppShellLabel,
  TabBar: AppShellTabBar,
  TabItem: AppShellTabItem,
  Main: AppShellMain,
  NowPlaying: AppShellNowPlaying,
};
export { AppShellSkeleton } from './app-shell';

export { useAppShell } from './app-shell.context';
export { appShellStyles } from './app-shell.variants';
