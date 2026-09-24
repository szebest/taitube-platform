import { subscriptionsApi } from "../api";

export const useIsSubscribed = (channelId: string | undefined, isLoggedIn: boolean) => {
	const { data, isLoading } = subscriptionsApi.useIsSubscribedQuery(channelId ?? '', {
		skip: !(isLoggedIn && channelId),
	});

	return { isSubscribed: data?.subscribed ?? false, isLoading };
};
