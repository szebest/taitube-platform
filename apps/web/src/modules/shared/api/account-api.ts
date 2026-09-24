import type { Account, Channel } from "@vp/api-contracts";

import { apiClient, baseApi, runApiQuery } from "src/base-api";

const accountApi = baseApi.injectEndpoints({
	endpoints: (builder) => ({
		account: builder.query<Account, void>({
			providesTags: ['ACCOUNT'],
			queryFn: () => runApiQuery(() => apiClient.me.getAccount()),
		}),
		channel: builder.query<Channel, string>({
			providesTags: (_result, _error, idOrHandle) => [{ type: 'CHANNEL', id: idOrHandle }],
			queryFn: (idOrHandle) =>
				runApiQuery(() => apiClient.channels.getChannel({ params: { idOrHandle } })),
		}),
	}),
});

export const { useAccountQuery, useChannelQuery } = accountApi;
