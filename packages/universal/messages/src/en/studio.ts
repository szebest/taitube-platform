import { dt } from '../define';

export const studio = {
  title: dt('Creator Studio'),
  backToWeb: dt('Back to Taitube'),
  retentionTitle: dt('Audience retention'),
  retentionChart: dt('Viewers who reached each point of the video'),
  retentionEmpty: dt('No playback data yet'),
  retentionStart: dt('Start'),
  retentionEnd: dt('End'),
  processingStatus: dt('Processing status'),
  processing: dt('{status:enum}, {overall:number}% encoded', {
    enum: {
      status: {
        UPLOADING: 'Uploading',
        UPLOADED: 'Uploaded',
        PROBING: 'Probing',
        PROCESSING: 'Processing',
        READY: 'Ready',
        FAILED: 'Failed',
        REJECTED: 'Rejected',
        ABANDONED: 'Abandoned',
        DELETED: 'Deleted',
      },
    },
    number: { overall: { maximumFractionDigits: 0 } },
  }),
} as const;
