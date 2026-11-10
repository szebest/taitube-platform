import { useRouter } from '@tanstack/react-router';
import { fromPromise, isOk } from '@vp/result';
import { useActionState } from 'react';
import { z } from 'zod';
import { settleSession } from '../session-changes';
import { signOut } from '../session-functions';
import { PERSONAS, signInAsPersona } from './persona-sign-in';

const SwitchSchema = z.enum(['guest', ...PERSONAS]);

type Switch = z.infer<typeof SwitchSchema>;

const LABELS: Record<Switch, string> = {
  guest: 'Guest',
  user: 'Viewer',
  creator: 'Creator',
  creator2: 'Second creator',
  moderator: 'Moderator',
  admin: 'Admin',
};

const FAILED_MESSAGE = 'That persona could not sign in. Is dev-token serve running?';

export interface PersonaSwitcherProps {
  /** A switch started: the caller drops the failure it showed for the last one. */
  onAttempt?: () => void;
  /** A switch failed: the caller shows this message where it wants it. */
  onFailed?: (message: string) => void;
}

function switchTo(persona: Switch): Promise<void> {
  return persona === 'guest' ? signOut() : signInAsPersona({ data: { persona } });
}

/**
 * Local demos only: signs in as a Guest or a persona with a token minted on this machine. An app
 * imports it from `@vp/queries/demo-personas` behind `VITE_DEMO_PERSONAS`, so a build that leaves
 * the flag off carries neither it, its server function nor its words (which is why they are not
 * in the catalogue).
 */
export function PersonaSwitcher({ onAttempt, onFailed }: PersonaSwitcherProps) {
  const router = useRouter();
  const [, switchPersona, isPending] = useActionState(
    async (_previous: null, form: FormData): Promise<null> => {
      onAttempt?.();
      const switched = await fromPromise(
        () => switchTo(SwitchSchema.parse(form.get('persona'))),
        (cause) => cause
      );
      if (!isOk(switched)) {
        onFailed?.(FAILED_MESSAGE);
        return null;
      }
      await settleSession(router);
      return null;
    },
    null
  );

  return (
    <form action={switchPersona}>
      <fieldset disabled={isPending}>
        <legend>Sign in as a demo persona</legend>
        {SwitchSchema.options.map((persona) => (
          <button key={persona} type="submit" name="persona" value={persona}>
            {LABELS[persona]}
          </button>
        ))}
      </fieldset>
    </form>
  );
}
