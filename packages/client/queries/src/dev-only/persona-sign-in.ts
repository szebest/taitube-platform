import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { requestCookieDomain } from '../session-config';
import { writeSessionCookie } from '../session-cookie';

/** `pnpm dev-token serve`, which `pnpm dev` starts; nothing in a production build reaches it. */
export const DEV_TOKEN_URL = 'http://localhost:3002';

export const PERSONAS = ['user', 'creator', 'admin'] as const;

const MintedSchema = z.object({ token: z.string() });

/** Signs in as a dev persona with a token minted on this machine. */
export const signInAsPersona = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ persona: z.enum(PERSONAS) }))
  .handler(async ({ data }) => {
    const minted = await fetch(`${DEV_TOKEN_URL}/token?persona=${data.persona}`);
    if (!minted.ok) {
      throw new Error(`dev-token serve answered ${minted.status}; pnpm dev starts it`);
    }
    writeSessionCookie(MintedSchema.parse(await minted.json()).token, requestCookieDomain());
  });
