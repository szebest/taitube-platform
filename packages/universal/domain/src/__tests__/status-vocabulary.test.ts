import {
  RENDITION_STATUSES,
  STEP_STATUSES,
  UPLOAD_STATUSES,
  USER_ROLES,
  VIDEO_STATUSES,
  VIDEO_VISIBILITIES,
} from '../status-vocabulary';

describe('packages/domain: status vocabulary', () => {
  it.each([
    {
      scenario: 'video statuses',
      vocabulary: VIDEO_STATUSES,
      spelling: [
        'UPLOADING',
        'UPLOADED',
        'PROBING',
        'PROCESSING',
        'READY',
        'FAILED',
        'REJECTED',
        'ABANDONED',
        'DELETED',
      ],
    },
    {
      scenario: 'video visibilities',
      vocabulary: VIDEO_VISIBILITIES,
      spelling: ['private', 'unlisted', 'public'],
    },
    {
      scenario: 'step statuses',
      vocabulary: STEP_STATUSES,
      spelling: ['QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD'],
    },
    {
      scenario: 'upload statuses',
      vocabulary: UPLOAD_STATUSES,
      spelling: ['OPEN', 'COMPLETED', 'ABORTED'],
    },
    {
      scenario: 'rendition statuses',
      vocabulary: RENDITION_STATUSES,
      spelling: ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED'],
    },
    {
      scenario: 'user roles',
      vocabulary: USER_ROLES,
      spelling: ['USER', 'CREATOR', 'MODERATOR', 'ADMIN'],
    },
  ])('spells the $scenario the way the database enum does', ({ vocabulary, spelling }) => {
    expect([...vocabulary]).toEqual(spelling);
    expect(new Set(vocabulary).size).toBe(vocabulary.length);
  });
});
