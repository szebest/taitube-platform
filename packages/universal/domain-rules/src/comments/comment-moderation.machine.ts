import { MODERATION_STATES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

export const COMMENT_MODERATION = defineMachine({
  name: 'comment-moderation',
  states: [...MODERATION_STATES, 'removed'],
  initial: ['published', 'held'],
  final: ['removed'],
  events: {
    hold: { from: ['published'], to: 'held' },
    approve: { from: ['held'], to: 'published' },
    hide: { from: ['published'], to: 'hidden' },
    unhide: { from: ['hidden'], to: 'published' },
    remove: { from: ['published', 'held', 'hidden'], to: 'removed' },
  },
});
