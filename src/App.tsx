import { Navigate } from "react-router";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { VideoPage } from "./modules/VideoPage/pages";
import { AllVideosPage } from "./modules/MainPage/pages";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path=''>
          <Route path='' element={<AllVideosPage />}></Route>
          <Route path="*" element={<Navigate to="" replace />} />
        </Route>
        <Route path='/watch'>
          <Route path=':videoId' element={<VideoPage />}></Route>
          <Route path="*" element={<Navigate to="/watch" replace />} />
        </Route>
        <Route path='*' element={<Navigate to=''></Navigate>}></Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
