import { baseApi } from "src/base-api";

import { User } from "../models";

export const authApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    userDetails: builder.query<User, void>({
      query: () => ({
        url: '/account/details',
      })
    })
  })
});

export const {
  useUserDetailsQuery
} = authApiSlice;