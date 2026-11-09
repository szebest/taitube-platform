import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requestCookieDomain, requestDevTokenUrl } from '../session-config';
import { writeSessionCookie } from '../session-cookie';

/** `pnpm dev-token serve`, which `pnpm dev` and `demo/start.sh` start; an app names another with `SSR_DEV_TOKEN_URL`. */
export const DEV_TOKEN_URL = 'http://localhost:3002';

export const PERSONAS = ['user', 'creator', 'creator2', 'moderator', 'admin'] as const;

const MintedSchema = z.object({ token: z.string() });

/** Signs in as a demo persona with a token minted on this machine. */
export const signInAsPersona = createServerFn({ method: 'POST' })
  .validator(z.object({ persona: z.enum(PERSONAS) }))
  .handler(async ({ data }) => {
    const minted = await fetch(
      `${requestDevTokenUrl() ?? DEV_TOKEN_URL}/token?persona=${data.persona}`
    );
    if (!minted.ok) {
      throw new Error(`dev-token serve answered ${minted.status}; pnpm dev starts it`);
    }
    writeSessionCookie(MintedSchema.parse(await minted.json()).token, requestCookieDomain());
  });
