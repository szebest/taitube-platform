import { type Result, err, ok } from '@kit/result';
import { VIDEO_PASSWORD_MAX_LENGTH, VIDEO_PASSWORD_MIN_LENGTH, type Video } from '@vp/domain';
import { type InvalidVideoPassword, invalidVideoPassword } from './failures';

/** A password only on an unlisted video, taken as typed: spaces are characters of a password. */
export function decideVideoPassword(
  password: string,
  video: Pick<Video, 'visibility'>
): Result<string, InvalidVideoPassword> {
  if (video.visibility !== 'unlisted') {
    return err(invalidVideoPassword('visibility', 'Only an unlisted video takes a password'));
  }
  const length = Array.from(password).length;
  if (length < VIDEO_PASSWORD_MIN_LENGTH || length > VIDEO_PASSWORD_MAX_LENGTH) {
    return err(
      invalidVideoPassword(
        'password',
        `A password is ${VIDEO_PASSWORD_MIN_LENGTH} to ${VIDEO_PASSWORD_MAX_LENGTH} characters`
      )
    );
  }
  return ok(password);
}
