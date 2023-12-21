import { useEffect, useMemo } from "react";

import { useLazyGetUserSubscriptionsQuery } from "../api";

export const useIsSubscribed = (userId: number, isLoggedIn: boolean) => {
  const [getSubscriptions, { data: subscriptionsArray, isLoading }] = useLazyGetUserSubscriptionsQuery();

  const data = useMemo(() => {
    return subscriptionsArray?.find(x => x.userId === userId);
  }, [subscriptionsArray, userId]);

  useEffect(() => {
    if (!isLoggedIn) return;

    getSubscriptions({}, true);
  }, [getSubscriptions, isLoggedIn]);

  return { isSubscribed: data?.isSubscribed, isLoading };
};