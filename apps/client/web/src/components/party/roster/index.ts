import { RosterGroup, RosterGuests, RosterMember, RosterRoleBadge, RosterRoot } from './roster';

export const Roster = {
  Root: RosterRoot,
  Group: RosterGroup,
  Member: RosterMember,
  RoleBadge: RosterRoleBadge,
  Guests: RosterGuests,
};
export type { RosterGroupProps, RosterMemberProps, RosterRoleBadgeProps } from './roster';
export type { RosterSource, RosterSync } from './types';
