import { createServerFn } from '@tanstack/react-start';
import { AccountSlotSchema } from '@vp/api-contracts';
import { z } from 'zod';
import { requestSession } from '../session-config';
import { type TokenIssuer, completeSignIn } from '../sign-in';

/** `pnpm dev-token serve`, which `pnpm dev` and `demo/start.sh` start; an app names another with `SSR_DEV_TOKEN_URL`. */
export const DEV_TOKEN_URL = 'http://localhost:3002';

export const PERSONAS = ['user', 'creator', 'creator2', 'moderator', 'admin'] as const;

const MintedSchema = z.object({ token: z.string() });

const SignInTargetSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('add'), state: z.string() }),
  z.strictObject({ mode: z.literal('slot'), slot: AccountSlotSchema }),
]);

/** The demo personas' provider: a token minted on this machine for the persona named. */
function devTokenIssuer(origin: string): TokenIssuer {
  return async (persona) => {
    const minted = await fetch(`${origin}/token?persona=${persona}`);
    if (!minted.ok) {
      throw new Error(`dev-token serve answered ${minted.status}; pnpm dev starts it`);
    }
    return MintedSchema.parse(await minted.json()).token;
  };
}

/** Signs a demo persona into a slot, or adds it beside the accounts signed in. */
export const signInAsPersona = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ persona: z.enum(PERSONAS), target: SignInTargetSchema }))
  .handler(({ data }) =>
    completeSignIn(
      devTokenIssuer(requestSession().devTokenUrl ?? DEV_TOKEN_URL),
      data.persona,
      data.target
    )
  );
