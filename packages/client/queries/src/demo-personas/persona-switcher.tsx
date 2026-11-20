import { assertNever, fromPromise, isOk } from '@kit/result';
import { useRouter } from '@tanstack/react-router';
import { useActionState } from 'react';
import { z } from 'zod';
import { settleSession, switchIdentity } from '../session-changes';
import { startAddAccount } from '../session-functions';
import { announceSessionChange } from '../session-sync';
import type { SignInOutcome } from '../sign-in';
import { useSignOut } from '../use-sign-out';
import { PERSONAS, signInAsPersona } from './persona-sign-in';

const SwitchSchema = z.enum(['guest', ...PERSONAS]);

type Switch = z.infer<typeof SwitchSchema>;

type Persona = (typeof PERSONAS)[number];

const LABELS: Record<Switch, string> = {
  guest: 'Guest',
  user: 'Viewer',
  creator: 'Creator',
  creator2: 'Second creator',
  moderator: 'Moderator',
  admin: 'Admin',
};

const FAILED_MESSAGE = 'That persona could not sign in. Is dev-token serve running?';

const REFUSED_MESSAGES = {
  'accounts-full': 'This browser holds as many accounts as it can. Sign one out first.',
  'rate-limited': 'Too many accounts added from here. Try again in a few minutes.',
  refused: 'That sign-in was not started here. Start adding the account again.',
} as const;

export interface PersonaSwitcherProps {
  /** Adds the persona beside the accounts signed in (`/login?add=1`), rather than into this tab's slot. */
  adding?: boolean;
  /** The slot to sign in again (`/login?slot=<n>`); this tab's own by default. */
  slot?: number;
  /** Where the tab goes once signed in, when it moves to another slot. */
  redirect?: string;
  /** A switch started: the caller drops the failure it showed for the last one. */
  onAttempt?: () => void;
  /** A switch failed: the caller shows this message where it wants it. */
  onFailed?: (message: string) => void;
}

/**
 * Local demos only: signs in as a Guest or a persona with a token minted on this machine, into this
 * tab's slot or, adding, into the first free one. An app imports it from `@vp/queries/demo-personas`
 * behind `VITE_DEMO_PERSONAS`, so a build that leaves the flag off carries neither it, its server
 * function nor its words (which is why they are not in the catalogue).
 */
export function PersonaSwitcher({
  adding = false,
  slot,
  redirect,
  onAttempt,
  onFailed,
}: PersonaSwitcherProps) {
  const router = useRouter();
  const signOut = useSignOut();
  const current = router.options.context.identity.read().identity.slot;

  const signIn = async (persona: Persona): Promise<SignInOutcome> => {
    const target = adding
      ? { mode: 'add' as const, state: await startAddAccount() }
      : { mode: 'slot' as const, slot: slot ?? current };
    return signInAsPersona({ data: { persona, target } });
  };

  const land = async (outcome: SignInOutcome): Promise<void> => {
    switch (outcome.kind) {
      case 'signed-in':
      case 'already-signed-in':
        if (adding) announceSessionChange({ type: 'added', slot: outcome.slot });
        if (outcome.slot === current && !adding) {
          await settleSession(router);
          return;
        }
        await switchIdentity(
          router,
          { slot: outcome.slot },
          { prefixed: outcome.accounts > 1, href: redirect ?? '/' }
        );
        return;
      case 'accounts-full':
      case 'rate-limited':
      case 'refused':
        onFailed?.(REFUSED_MESSAGES[outcome.kind]);
        return;
      default:
        assertNever(outcome, 'sign-in outcome');
    }
  };

  const [, switchPersona, isPending] = useActionState(
    async (_previous: null, form: FormData): Promise<null> => {
      onAttempt?.();
      const persona = SwitchSchema.parse(form.get('persona'));
      if (persona === 'guest') {
        await signOut();
        return null;
      }
      const outcome = await fromPromise(
        () => signIn(persona),
        (cause) => cause
      );
      if (!isOk(outcome)) {
        onFailed?.(FAILED_MESSAGE);
        return null;
      }
      await land(outcome.value);
      return null;
    },
    null
  );

  return (
    <form action={switchPersona}>
      <fieldset disabled={isPending}>
        <legend>{adding ? 'Add a demo persona' : 'Sign in as a demo persona'}</legend>
        {SwitchSchema.options.map((persona) =>
          adding && persona === 'guest' ? null : (
            <button key={persona} type="submit" name="persona" value={persona}>
              {LABELS[persona]}
            </button>
          )
        )}
      </fieldset>
    </form>
  );
}
