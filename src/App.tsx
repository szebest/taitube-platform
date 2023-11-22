import { Navigate } from "react-router";
import { BrowserRouter, Route, Routes } from "react-router-dom";

// providers
import { ApiProvider } from "@reduxjs/toolkit/dist/query/react";

import { AuthProvider } from "./modules/shared/providers";

// pages
import { VideoPage } from "./modules/VideoPage/pages";
import { AllVideosPage } from "./modules/MainPage/pages";

// layouts
import { DefaultLayout } from "./layout/containers";

// api
import { authApiSlice } from "./modules/shared/api/authApiSlice";

export function App() {
  return (
    <ApiProvider api={authApiSlice}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path='' element={<DefaultLayout />}>
              <Route path='' element={<AllVideosPage />}></Route>
              <Route path="*" element={<Navigate to="" replace />} />
            </Route>
            <Route path='/watch' element={<DefaultLayout />}>
              <Route path=':videoId' element={<VideoPage />}></Route>
              <Route path="*" element={<Navigate to="/watch" replace />} />
            </Route>
            <Route path='*' element={<Navigate to=''></Navigate>}></Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ApiProvider>
  );
}

export default App;
