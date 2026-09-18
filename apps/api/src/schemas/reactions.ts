import { z } from 'zod';

export const ReactionTypeSchema = z.enum(['LIKE', 'DISLIKE']).nullable();

export const ReactionInputSchema = z.object({
  type: z.enum(['LIKE', 'DISLIKE', 'NONE']).describe('Reaction type: LIKE, DISLIKE, or NONE to clear'),
});

export const VideoReactionResponseSchema = z.object({
  videoId: z.string().uuid().describe('Video UUID identifier'),
  reaction: ReactionTypeSchema.describe('User reaction state: LIKE, DISLIKE, or null'),
  likesCount: z.number().int().nonnegative().describe('Current total likes count'),
  dislikesCount: z.number().int().nonnegative().describe('Current total dislikes count'),
});

export const UserReactionResponseSchema = z.object({
  videoId: z.string().uuid().describe('Video UUID identifier'),
  reaction: ReactionTypeSchema.describe('Authenticated user reaction: LIKE, DISLIKE, or null'),
});

export type ReactionInput = z.infer<typeof ReactionInputSchema>;
export type VideoReactionResponse = z.infer<typeof VideoReactionResponseSchema>;
export type UserReactionResponse = z.infer<typeof UserReactionResponseSchema>;
