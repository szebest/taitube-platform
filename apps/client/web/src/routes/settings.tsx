import { createFileRoute } from '@tanstack/react-router';

import { SettingsLayout } from '#app/features/settings/components/settings-layout';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Settings - Taitube' }] }),
  component: SettingsLayout,
});
