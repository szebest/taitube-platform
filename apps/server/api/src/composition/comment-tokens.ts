import { token } from '@vp/composition';
import type {
  ChannelRestrictionService,
  CommentBulkService,
  CommentModerationService,
  CommentRemovalService,
  CommentReportService,
  CommentService,
  CommentSettingsService,
  SavedReplyService,
  TrustedCommenterService,
} from '../services/index';

export interface CommentServiceSet {
  trustedCommenterService: TrustedCommenterService;
  savedReplyService: SavedReplyService;
  commentService: CommentService;
  channelRestrictionService: ChannelRestrictionService;
  commentBulkService: CommentBulkService;
  commentModerationService: CommentModerationService;
  commentRemovalService: CommentRemovalService;
  commentSettingsService: CommentSettingsService;
  commentReportService: CommentReportService;
}

export const CommentServices = {
  TrustedCommenterService: token<TrustedCommenterService>('TrustedCommenterService'),
  SavedReplyService: token<SavedReplyService>('SavedReplyService'),
  CommentService: token<CommentService>('CommentService'),
  ChannelRestrictionService: token<ChannelRestrictionService>('ChannelRestrictionService'),
  CommentBulkService: token<CommentBulkService>('CommentBulkService'),
  CommentModerationService: token<CommentModerationService>('CommentModerationService'),
  CommentRemovalService: token<CommentRemovalService>('CommentRemovalService'),
  CommentSettingsService: token<CommentSettingsService>('CommentSettingsService'),
  CommentReportService: token<CommentReportService>('CommentReportService'),
};
