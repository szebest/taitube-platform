import type { ReactionInput, UserReaction, VideoReaction } from "@vp/api-contracts";

import { apiClient, baseApi, runApiQuery } from "src/base-api";

/** @internal */
export const reactionsApi =baseApi.injectEndpoints({
	endpoints: (builder) => ({
		myReaction: builder.query<UserReaction, string>({
			providesTags: (_result, _error, id) => [{ type: 'REACTION', id }],
			queryFn: (id) => runApiQuery(() => apiClient.reactions.getMyReaction({ params: { id } })),
		}),
		setReaction: builder.mutation<VideoReaction, { id: string } & ReactionInput>({
			invalidatesTags: (_result, _error, { id }) => [
				{ type: 'REACTION', id },
				{ type: 'VIDEO', id },
			],
			queryFn: ({ id, type }) =>
				runApiQuery(() => apiClient.reactions.setReaction({ params: { id }, body: { type } })),
		}),
	}),
});

export const { useMyReactionQuery, useSetReactionMutation } = reactionsApi;
