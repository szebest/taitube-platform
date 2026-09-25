import { lazy } from "react";
import { Navigate } from "react-router";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ApiProvider } from "@reduxjs/toolkit/dist/query/react";

import { baseApi } from "./base-api";
import { DefaultLayout } from "./layout/containers";
import { AuthorizedContainer } from "./modules/shared/components";
import { AuthProvider, PermissionsProvider, SidebarProvider, ThemeProvider } from "./modules/shared/providers";

const VideoPage = lazy(() =>
	import("./modules/VideoPage").then((module) => ({
		default: module.VideoPage,
	}))
);
const AllVideosPage = lazy(() =>
	import("./modules/AllVideosPage").then((module) => ({
		default: module.AllVideosPage,
	}))
);
const TrendingPage = lazy(() =>
	import("./modules/Trending").then((module) => ({
		default: module.TrendingPage,
	}))
);
const SubscriptionPage = lazy(() =>
	import("./modules/Subscriptions").then((module) => ({
		default: module.SubscriptionsPage,
	}))
);
const SubscriptionVideosPage = lazy(() =>
	import("./modules/SubscriptionVideos").then((module) => ({
		default: module.SubscriptionVideosPage,
	}))
);
const UserPage = lazy(() =>
	import("./modules/UserPage").then((module) => ({
		default: module.UserPage,
	}))
);
const UploadPage = lazy(() =>
	import("./modules/Upload").then((module) => ({ default: module.UploadPage }))
);
const EditPage = lazy(() =>
	import("./modules/Upload").then((module) => ({ default: module.EditPage }))
);

export function App() {
	return (
		<ApiProvider api={baseApi}>
			<AuthProvider>
				<PermissionsProvider>
					<SidebarProvider>
						<ThemeProvider>
							<Routes>
								<Route path="" element={<DefaultLayout />}>
									<Route path="" element={<AllVideosPage />} />
									<Route path="*" element={<Navigate to="" replace />} />
								</Route>
								<Route path="/trending" element={<DefaultLayout />}>
									<Route path="" element={<TrendingPage />} />
									<Route path="*" element={<Navigate to="/trending" replace />} />
								</Route>
								<Route
									path="/subscriptions"
									element={
										<AuthorizedContainer>
											<DefaultLayout />
										</AuthorizedContainer>
									}
								>
									<Route path="" element={<SubscriptionPage />} />
									<Route
										path="videos"
										element={<SubscriptionVideosPage />}
									/>
									<Route
										path="*"
										element={<Navigate to="/subscriptions/videos" replace />}
									/>
								</Route>
								<Route path="/watch" element={<DefaultLayout />}>
									<Route path=":videoId" element={<VideoPage />} />
									<Route path="" element={<Navigate to="/" replace />} />
									<Route path="*" element={<Navigate to="/" replace />} />
								</Route>
								<Route path="/channel" element={<DefaultLayout />}>
									<Route path=":channelId" element={<UserPage />} />
									<Route path="" element={<Navigate to="/" replace />} />
									<Route path="*" element={<Navigate to="/" replace />} />
								</Route>
								<Route
									path="/upload"
									element={
										<AuthorizedContainer>
											<DefaultLayout maxWidth="1280px" />
										</AuthorizedContainer>
									}
								>
									<Route path="" element={<UploadPage />} />
									<Route path="edit/:videoId" element={<EditPage />} />
									<Route path="*" element={<Navigate to="/upload" replace />} />
								</Route>

								<Route path="*" element={<Navigate to="" />} />
							</Routes>
							<ToastContainer limit={3} />
						</ThemeProvider>
					</SidebarProvider>
				</PermissionsProvider>
			</AuthProvider>
		</ApiProvider>
	);
}
