export type TeamRole = 'manager' | 'editor' | 'moderator' | 'analytics';

export type Persona = 'creator' | 'viewer' | TeamRole;

type SeededVideo = { id: string; title: string };

export type Stack = {
  apiUrl: string;
  personas: Record<Persona, string>;
  /** The creator's channel, with a member persona per role on its team. */
  team: { channelId: string; ownerId: string; userIds: Record<TeamRole, string> };
  videos: {
    watchable: SeededVideo;
    canvas: SeededVideo;
    /** Long enough to take a clip: the other seeded videos last two seconds. */
    clippable: SeededVideo;
    draft: SeededVideo;
  };
};
