import { Outlet } from "react-router-dom";
import { Header } from "src/layout/components";


export function DefaultLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}

export default DefaultLayout;
