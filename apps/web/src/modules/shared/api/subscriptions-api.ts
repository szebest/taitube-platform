import type { IsSubscribed, KeysetQuery, ListSubscriptionsResponse, SubscriptionState } from "@vp/api-contracts";

import { apiClient, baseApi, runApiQuery } from "src/base-api";

export const subscriptionsApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
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
