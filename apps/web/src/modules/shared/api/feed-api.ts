import type { FeedQuery, FeedResponse, KeysetQuery } from "@vp/api-contracts";

import { apiClient, baseApi, runApiQuery } from "src/base-api";

import { appendPage } from "./page-merge";

export type PublicFeedQuery = FeedQuery;

export const feedApi =baseApi.injectEndpoints({
	endpoints: (builder) => ({
		publicFeed: builder.query<FeedResponse, PublicFeedQuery>({
			providesTags: ['VIDEOS'],
			queryFn: (query) => runApiQuery(() => apiClient.feed.getFeed({ query })),
			serializeQueryArgs: ({ endpointName, queryArgs }) =>
				`${endpointName}:${queryArgs.sort ?? 'recent'}:${queryArgs.categoryId ?? 'all'}`,
			merge: appendPage,
			forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
		}),
		subscriptionFeed: builder.query<FeedResponse, KeysetQuery>({
			providesTags: ['VIDEOS', 'SUBSCRIPTION'],
			queryFn: (query) =>
				runApiQuery(() => apiClient.subscriptions.getSubscriptionFeed({ query })),
			serializeQueryArgs: ({ endpointName }) => endpointName,
			merge: appendPage,
			forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
		}),
	}),
});
