import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { API_BASE_URL } from "src/config";

import { User } from "../models";

export const authApiSlice = createApi({
  reducerPath: 'auth',
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL, credentials: 'include' }),
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