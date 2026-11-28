import {
  RosterControlMark,
  RosterGroup,
  RosterGuests,
  RosterMember,
  RosterRoleBadge,
  RosterRoot,
} from './roster';

export const Roster = {
  Root: RosterRoot,
  Group: RosterGroup,
  Member: RosterMember,
  RoleBadge: RosterRoleBadge,
  Guests: RosterGuests,
  ControlMark: RosterControlMark,
};
export type {
  RosterControlMarkProps,
  RosterGroupProps,
  RosterMemberProps,
  RosterRoleBadgeProps,
} from './roster';
export type { RosterSource, RosterSync } from './types';
