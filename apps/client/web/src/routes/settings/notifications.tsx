import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SettingsSectionPage } from '#app/features/settings/components/settings-section-page';

export const Route = createFileRoute('/settings/notifications')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Notifications settings - Taitube' }] }),
  component: NotificationSettings,
});

function NotificationSettings() {
  return <SettingsSectionPage section="notifications" />;
}
