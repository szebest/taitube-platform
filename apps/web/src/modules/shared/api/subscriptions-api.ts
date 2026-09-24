import type { IsSubscribed, KeysetQuery, ListSubscriptionsResponse, SubscriptionState } from "@vp/api-contracts";

import { apiClient, baseApi, runApiQuery } from "src/base-api";

const subscriptionsApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		// biome-ignore lint/suspicious/noConfusingVoidType: RTK Query spells "callable with no argument" as void; undefined would force every caller to pass one.
		mySubscriptions: builder.query<ListSubscriptionsResponse, KeysetQuery | void>({
			providesTags: ['SUBSCRIPTION'],
			queryFn: (query) =>
				runApiQuery(() => apiClient.subscriptions.listMySubscriptions({ query: query ?? {} })),
		}),
		isSubscribed: builder.query<IsSubscribed, string>({
			providesTags: (_result, _error, id) => [{ type: 'SUBSCRIPTION', id }],
			queryFn: (id) =>
				runApiQuery(() => apiClient.subscriptions.isSubscribedToChannel({ params: { id } })),
		}),
		subscribe: builder.mutation<SubscriptionState, string>({
			invalidatesTags: ['SUBSCRIPTION', 'CHANNEL'],
			queryFn: (id) =>
				runApiQuery(() => apiClient.subscriptions.subscribeToChannel({ params: { id } })),
		}),
		unsubscribe: builder.mutation<SubscriptionState, string>({
			invalidatesTags: ['SUBSCRIPTION', 'CHANNEL'],
			queryFn: (id) =>
				runApiQuery(() => apiClient.subscriptions.unsubscribeFromChannel({ params: { id } })),
		}),
	}),
});

export const {
	useMySubscriptionsQuery,
	useIsSubscribedQuery,
	useSubscribeMutation,
	useUnsubscribeMutation,
} = subscriptionsApi;
