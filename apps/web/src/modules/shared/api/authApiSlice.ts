import { baseApi } from "src/base-api";

import { User, UserFriend } from "../models";

export const authApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    userDetails: builder.query<User, void>({
      query: () => ({
        url: '/account/details',
      })
    }),
    userFriends: builder.query<UserFriend[], void>({
      query: () => ({
        url: '/account/friends',
      })
    })
  })
});

export const {
  useUserDetailsQuery,
  useUserFriendsQuery
} = authApiSlice;