import { dt } from '../engine';

export const videoToolErrors = {
  revisionNotFound: dt('This version of the video does not exist.'),
  correctionNotFound: dt('This correction does not exist.'),
  correctionLimit: dt('This video already has the most corrections it can hold.'),
  shareLinkNotFound: dt('This share link does not exist.'),
  shareLinkExpired: dt(
    'This share link has expired or was revoked. Ask the creator for a new one.'
  ),
  shareLinkLimit: dt(
    'This video already has the most active share links it can hold. Revoke one to add another.'
  ),
  videoPasswordRequired: dt('This video is protected by a password.'),
  videoPasswordInvalid: dt('That password is not right.'),
  videoPasswordsOff: dt('Passwords are switched off on this server.'),
  experimentNotFound: dt('This test does not exist.'),
  experimentLimit: dt(
    'A test is already running on this video, or the channel runs the most tests it can.'
  ),
  experimentNotRunning: dt('This test has already ended.'),
  generationInProgress: dt(
    'A new file or an edit is already being processed for this video. Wait for it to finish.'
  ),
  replacementNotUploaded: dt('The new file has not finished uploading. Upload it and try again.'),
  noEditToRevert: dt('This video has no applied edit to revert.'),
};
