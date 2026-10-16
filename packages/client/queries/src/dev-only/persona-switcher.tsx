import { useRouter } from '@tanstack/react-router';
import { fromPromise, isOk } from '@vp/result';
import { useActionState } from 'react';
import { z } from 'zod';

import { PERSONAS, signInAsPersona } from './persona-sign-in';
import { settleSession } from '../session-changes';
import { signOut } from '../session-functions';

const SwitchSchema = z.enum(['guest', ...PERSONAS]);

type Switch = z.infer<typeof SwitchSchema>;

const LABELS: Record<Switch, string> = {
  guest: 'Guest',
  user: 'User',
  creator: 'Creator',
  admin: 'Admin',
};

type SwitchState = 'idle' | 'failed';

function switchTo(persona: Switch): Promise<void> {
  return persona === 'guest' ? signOut() : signInAsPersona({ data: { persona } });
}

/**
 * Development only: signs in as Guest, User, Creator or Admin with a token minted on this machine.
 * An app imports it from `@vp/queries/dev-personas` behind `import.meta.env.DEV`, so no production
 * bundle carries it, its server function or its words (which is why they are not in the catalogue).
 */
export function PersonaSwitcher() {
  const router = useRouter();
  const [state, switchPersona, isPending] = useActionState(
    async (_previous: SwitchState, form: FormData): Promise<SwitchState> => {
      const switched = await fromPromise(
        () => switchTo(SwitchSchema.parse(form.get('persona'))),
        (cause) => cause
      );
      if (!isOk(switched)) return 'failed';
      await settleSession(router);
      return 'idle';
    },
    'idle'
  );

  return (
    <form action={switchPersona}>
      <fieldset disabled={isPending}>
        <legend>Sign in as a dev persona</legend>
        {SwitchSchema.options.map((persona) => (
          <button key={persona} type="submit" name="persona" value={persona}>
            {LABELS[persona]}
          </button>
        ))}
      </fieldset>
      {state === 'failed' && (
        <p role="alert">That persona could not sign in. Is pnpm dev running dev-token serve?</p>
      )}
    </form>
  );
}
