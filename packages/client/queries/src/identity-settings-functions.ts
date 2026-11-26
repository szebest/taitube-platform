import { createServerFn } from '@tanstack/react-start';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';
import { ACCENTS, AccountChannelSchema, withAccent, withPinned } from './accounts';
import { readAccounts, writeAccounts } from './accounts-cookie';
import { requestSession } from './session-config';

const IdentityInputSchema = z.strictObject({
  slot: AccountSlotSchema,
  channel: AccountChannelSchema.optional(),
});

/** Gives an identity the ring colour the viewer picked for it. */
export const setIdentityAccent = createServerFn({ method: 'POST' })
  .validator(IdentityInputSchema.extend({ accent: z.literal(ACCENTS) }))
  .handler(({ data: { accent, ...identity } }) => {
    writeAccounts(withAccent(readAccounts(), identity, accent), requestSession().cookieDomain);
  });

/** The identities pinned to the top of the switcher, in the order given. */
export const setPinnedIdentities = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ pinned: z.array(IdentityInputSchema).max(10) }))
  .handler(({ data }) => {
    writeAccounts(withPinned(readAccounts(), data.pinned), requestSession().cookieDomain);
  });
