import type { CategoriesList } from "@vp/api-contracts";

import { apiClient, baseApi, runApiQuery } from "src/base-api";

export const categoriesApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		categories: builder.query<CategoriesList, void>({
			keepUnusedDataFor: 300,
			queryFn: () => runApiQuery(() => apiClient.categories.listCategories()),
		}),
	}),
});

export const { useCategoriesQuery } = categoriesApi;
