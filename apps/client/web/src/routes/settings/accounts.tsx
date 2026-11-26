import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  AccountAccentRow,
  AccountOrderRow,
  OwnedChannelsRow,
  SettingsSectionPage,
  SignInHistoryRow,
} from '#app/features/account';

export const Route = createFileRoute('/settings/accounts')({
  validateSearch: z.object({}),
  head: () => ({ meta: [{ title: 'Accounts settings - Taitube' }] }),
  component: AccountsSettings,
});

function AccountsSettings() {
  return (
    <SettingsSectionPage section="accounts">
      <AccountOrderRow />
      <AccountAccentRow />
      <OwnedChannelsRow />
      <SignInHistoryRow />
    </SettingsSectionPage>
  );
}
