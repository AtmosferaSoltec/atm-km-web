import { Navigate, Outlet, createBrowserRouter, RouterProvider, useLocation } from "react-router";

import { AppShell } from "./components/app-shell";
import { KmMark } from "./components/km-mark";
import { useAuth } from "./lib/auth";
import { FuelPage } from "./pages/fuel";
import { HomePage } from "./pages/home";
import { LoginPage } from "./pages/login";
import { SettingsPage } from "./pages/settings";
import { SharePage } from "./pages/share";
import { LendPage, ReturnTripPage } from "./pages/trip-forms";
import { TripDetailPage, TripsPage } from "./pages/trips";
import { ROUTES } from "./lib/routes";

/** Everything but the login and the share page needs a session. */
function RequireSession() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === "loading") return <Splash />;
  if (auth.status === "anonymous") {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

function LoginRoute() {
  const auth = useAuth();
  return auth.status === "loading" ? <Splash /> : <LoginPage />;
}

/** While the session is renewed from the cookie: a blink, not a login screen. */
function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-pulse">
        <KmMark size={56} />
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginRoute /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: ROUTES.home, element: <HomePage /> },
          { path: ROUTES.lend, element: <LendPage /> },
          { path: ROUTES.trips, element: <TripsPage /> },
          { path: "/trips/:id", element: <TripDetailPage /> },
          { path: "/trips/:id/return", element: <ReturnTripPage /> },
          { path: ROUTES.fuel, element: <FuelPage /> },
          { path: ROUTES.settings, element: <SettingsPage /> },
        ],
      },
    ],
  },
  // The borrower's page: no tab bar and no session.
  { path: "/share/:token", element: <SharePage /> },
  { path: "*", element: <Navigate to={ROUTES.home} replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
