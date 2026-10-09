import {
  categoryNotFound,
  videoEditForbidden,
  videoForbidden,
  videoNotFound,
  videoReadRequiresAuth,
} from '@vp/domain-rules';
import { ErrorCodes, databaseUnavailable, versionConflict } from '@vp/errors';
import { presentPublicVideoFailure } from '../videos.presenter';

const instance = '/v1/videos/v1';

describe('presentPublicVideoFailure', () => {
  it.each([
    { name: 'an absent video', failure: videoNotFound('v1') },
    { name: 'a video the caller may not read', failure: videoForbidden('v1') },
  ])('answers $name with a 404 that names no reason', ({ failure }) => {
    const problem = presentPublicVideoFailure(failure, instance);

    expect(problem.status).toBe(404);
    expect(problem.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('renders the two indistinguishably, which is the property the disguise exists for', () => {
    expect(presentPublicVideoFailure(videoForbidden('v1'), instance)).toEqual(
      presentPublicVideoFailure(videoNotFound('v1'), instance)
    );
  });

  it('keeps a refusal to edit a video the caller can see as a 403, which hides nothing', () => {
    const problem = presentPublicVideoFailure(videoEditForbidden('v1'), instance);

    expect(problem.status).toBe(403);
    expect(problem.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('asks an anonymous caller to authenticate rather than hiding the video from them', () => {
    const problem = presentPublicVideoFailure(videoReadRequiresAuth('v1'), instance);

    expect(problem.status).toBe(401);
    expect(problem.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it.each([
    { name: 'a stale version', failure: versionConflict('v1', 2), status: 409 },
    { name: 'a category that is not there', failure: categoryNotFound('c1'), status: 404 },
    { name: 'a dead database', failure: databaseUnavailable('findWithDetails'), status: 503 },
  ])('gives $name the standard $status', ({ failure, status }) => {
    expect(presentPublicVideoFailure(failure, instance).status).toBe(status);
  });

  it('keeps the repository operation off the wire on a dead database', () => {
    const problem = presentPublicVideoFailure(databaseUnavailable('findWithDetails'), instance);

    expect(JSON.stringify(problem)).not.toContain('findWithDetails');
  });
});
