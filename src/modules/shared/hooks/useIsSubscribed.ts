import { useMemo } from "react";

import { useGetUserSubscriptionsQuery } from "../api";

export const useIsSubscribed = (userId: number, isLoggedIn: boolean) => {
	const { data: subscriptionsArray, isLoading } = useGetUserSubscriptionsQuery({}, { skip: !isLoggedIn });

	const data = useMemo(() => {
		return subscriptionsArray?.find(x => x.userId === userId);
	}, [subscriptionsArray, userId]);

	return { isSubscribed: data?.isSubscribed, isLoading };
};