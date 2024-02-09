import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { API_BASE_URL } from "src/config";

export const baseApi = createApi({
	baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL, credentials: 'include' }),
	endpoints: () => ({}),
	tagTypes: ['VIDEOS']
});