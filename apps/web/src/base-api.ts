import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { ApiError, createApiClient } from "@vp/api-client";
import { fromPromise, isOk } from "@vp/result";

import { readAuthToken } from "src/auth-token";
import { API_BASE_URL } from "src/config";

export const apiClient = createApiClient({
	baseUrl: API_BASE_URL,
	getAuthToken: readAuthToken,
});

export type ApiQueryError = {
	status: number;
	code: string;
	message: string;
};

export function toQueryError(error: unknown): ApiQueryError {
	if (error instanceof ApiError) {
		return { status: error.status, code: error.code, message: error.message };
	}
	return {
		status: 0,
		code: 'NETWORK_ERROR',
		message: error instanceof Error ? error.message : 'Request failed',
	};
}

export async function runApiQuery<T>(
	call: () => Promise<T>
): Promise<{ data: T } | { error: ApiQueryError }> {
	const answered = await fromPromise(call, toQueryError);
	return isOk(answered) ? { data: answered.value } : { error: answered.error };
}

export const baseApi = createApi({
	baseQuery: fakeBaseQuery<ApiQueryError>(),
	endpoints: () => ({}),
	tagTypes: ['ACCOUNT', 'CHANNEL', 'REACTION', 'SUBSCRIPTION', 'VIDEO', 'VIDEOS']
});
