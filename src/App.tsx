import { lazy } from "react";
import { Navigate } from "react-router";
import { BrowserRouter, Route, Routes } from "react-router-dom";

// providers
import { ApiProvider } from "@reduxjs/toolkit/dist/query/react";

import { AuthProvider, SidebarProvider } from "./modules/shared/providers";

// layouts
import { DefaultLayout } from "./layout/containers";

// api
import { baseApi } from "./base-api";

// components
import { AuthorizedContainer } from "./modules/shared/components";

// pages
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

export function App() {
	return (
		<ApiProvider api={baseApi}>
			<AuthProvider>
				<SidebarProvider>
					<BrowserRouter>
						<Routes>
							<Route path="" element={<DefaultLayout />}>
								<Route path="" element={<AllVideosPage />}></Route>
								<Route path="*" element={<Navigate to="" replace />} />
							</Route>
							<Route path="/trending" element={<DefaultLayout />}>
								<Route path="" element={<TrendingPage />}></Route>
								<Route path="*" element={<Navigate to="/trending" replace />} />
							</Route>
							<Route path="/subscriptions" element={<DefaultLayout />}>
								<Route path="" element={<SubscriptionPage />}></Route>
								<Route path="videos" element={<SubscriptionVideosPage />}></Route>
								<Route path="*" element={<Navigate to="/subscriptions/videos" replace />} />
							</Route>
							<Route path="/watch" element={<DefaultLayout />}>
								<Route path=":videoId" element={<VideoPage />}></Route>
								<Route path="" element={<Navigate to="/" replace />} />
								<Route path="*" element={<Navigate to="/" replace />} />
							</Route>
							<Route path="/user" element={<DefaultLayout />}>
								<Route path=":userId" element={<UserPage />}></Route>
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
								<Route path="" element={<UploadPage />}></Route>
								<Route path="*" element={<Navigate to="/upload" replace />} />
							</Route>

							<Route path="*" element={<Navigate to=""></Navigate>}></Route>
						</Routes>
					</BrowserRouter>
				</SidebarProvider>
			</AuthProvider>
		</ApiProvider>
	);
}

export default App;
