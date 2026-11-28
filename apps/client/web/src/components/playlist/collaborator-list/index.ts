import {
  CollaboratorListActions,
  CollaboratorListAvatar,
  CollaboratorListItem,
  CollaboratorListMeta,
  CollaboratorListName,
  CollaboratorListRoot,
} from './collaborator-list';

export const CollaboratorList = {
  Root: CollaboratorListRoot,
  Item: CollaboratorListItem,
  Avatar: CollaboratorListAvatar,
  Name: CollaboratorListName,
  Meta: CollaboratorListMeta,
  Actions: CollaboratorListActions,
};

export type { CollaboratorListAvatarProps } from './collaborator-list';
export { CollaboratorListSkeleton } from './components/collaborator-list-skeleton/collaborator-list-skeleton';
