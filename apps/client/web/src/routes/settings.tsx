import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '#app/features/account/components/settings-layout/settings-layout';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Settings - Taitube' }] }),
  component: SettingsLayout,
});
