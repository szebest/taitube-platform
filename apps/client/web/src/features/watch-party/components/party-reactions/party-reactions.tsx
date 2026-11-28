import { WATCH_PARTY_REACTIONS } from '@vp/domain';
import type { WatchPartySocket } from '@vp/queries';
import { ReactionOverlay } from '#app/components/party/reaction-overlay';
import { usePartyControls } from '#app/features/watch-party/hooks/use-party-controls';
import { countReactions } from '#app/features/watch-party/utils/count-reactions';
import { useReducedMotion } from '#app/hooks/use-reduced-motion';

interface PartyReactionsProps {
  roomId: string;
  socket: WatchPartySocket;
}

/** What the room's members reacted with, minus the members the viewer hid: bursts, or count chips on reduced motion. */
export function PartyReactionOverlay({ roomId, socket }: PartyReactionsProps) {
  const reducedMotion = useReducedMotion();
  const controls = usePartyControls(roomId, socket.state.you?.kind);
  const shown = socket.state.reactions.filter(
    (reaction) => !controls.resolved(reaction.memberKey).hideReactions
  );

  return (
    <ReactionOverlay.Root>
      {reducedMotion
        ? countReactions(shown).map(({ emoji, count }) => (
            <ReactionOverlay.Chip key={emoji} emoji={emoji} count={count} />
          ))
        : shown.map(({ id, emoji }) => (
            <ReactionOverlay.Burst key={id} emoji={emoji} at={(id * 37) % 85} />
          ))}
    </ReactionOverlay.Root>
  );
}

/** The palette under the stage: a reaction is one frame, folded and fanned out by the room. */
export function PartyReactionBar({ socket }: Pick<PartyReactionsProps, 'socket'>) {
  return (
    <ReactionOverlay.Bar
      emojis={WATCH_PARTY_REACTIONS}
      onReact={(emoji) => socket.send({ type: 'react', emoji })}
    />
  );
}
