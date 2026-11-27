import { dt } from '../engine';

export const playlistErrors = {
  playlistCollaboratorExists: dt(
    'This person already works on the playlist or has an invite waiting.'
  ),
  playlistCollaboratorLimit: dt('This playlist already has the most collaborators it can hold.'),
  playlistCollaboratorNotFound: dt('This person does not work on the playlist.'),
  playlistInviteInvalid: dt(
    'This invite has expired, was revoked or has been used up. Ask the owner for a new one.'
  ),
  playlistActivityNotFound: dt('This change is not in the activity of this playlist.'),
  playlistActivityNotRestorable: dt(
    'This change cannot be undone, or its video is back in the playlist already.'
  ),
};
