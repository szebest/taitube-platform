import { useAccount } from '@vp/queries';
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';
import { useSetReaction } from '#app/hooks/use-set-reaction';
import { useSetSubscription } from '#app/hooks/use-set-subscription';
import { forgetIntent, intentIn, rawIntent } from '#app/lib/account-action/replay-intent';
import { urlModals } from '#app/lib/url-modal/registry';

interface ReplayProps {
  id: string;
  onDone: () => void;
}

function ReplayLike({ id, onDone }: ReplayProps) {
  const { mutate } = useSetReaction(id);
  const replay = useEffectEvent(() => {
    mutate('LIKE');
    onDone();
  });

  useEffect(() => replay(), []);

  return null;
}

function ReplaySubscribe({ id, onDone }: ReplayProps) {
  const { mutate } = useSetSubscription(id);
  const replay = useEffectEvent(() => {
    mutate(true);
    onDone();
  });

  useEffect(() => replay(), []);

  return null;
}

function ReplaySave({ id, onDone }: ReplayProps) {
  const { open } = urlModals.useUrlModal('save-to-playlist');
  const replay = useEffectEvent(() => {
    open({ videoId: id });
    onDone();
  });

  useEffect(() => replay(), []);

  return null;
}

const subscribeNever = () => () => undefined;

const noIntent = () => null;

/** Carries on with the like, subscribe or save a guest pressed before signing in, once, and renders nothing. */
export function ReplayIntent() {
  const account = useAccount();
  const intent = intentIn(useSyncExternalStore(subscribeNever, rawIntent, noIntent));

  if (!(account && intent)) {
    return null;
  }

  const props = { id: intent.id, onDone: forgetIntent };
  switch (intent.kind) {
    case 'like':
      return <ReplayLike {...props} />;
    case 'subscribe':
      return <ReplaySubscribe {...props} />;
    case 'save':
      return <ReplaySave {...props} />;
  }
}
