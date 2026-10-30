import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { Spinner } from "./components/ui";

// Eagerly-loaded (small, always needed)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

// Lazy-loaded (only needed when the user navigates there)
const Dashboard   = lazy(() => import("./pages/Dashboard"));
const Scanner     = lazy(() => import("./pages/Scanner"));
const Farms       = lazy(() => import("./pages/Farms"));
const Weather     = lazy(() => import("./pages/Weather"));
const Settings    = lazy(() => import("./pages/Settings"));
const Schemes     = lazy(() => import("./pages/Schemes"));
const GovtStores  = lazy(() => import("./pages/GovtStores"));
const Mandi       = lazy(() => import("./pages/Mandi"));
const Assistant   = lazy(() => import("./pages/Assistant"));
const Calendar    = lazy(() => import("./pages/Calendar"));
const Expenses    = lazy(() => import("./pages/Expenses"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ScamReport  = lazy(() => import("./pages/ScamReport"));

const Loading = () => (
  <div className="py-16"><Spinner label="Loading…" /></div>
);

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><Suspense fallback={<Loading />}>{children}</Suspense></ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/schemes" element={<Suspense fallback={<Loading />}><Schemes /></Suspense>} />
        <Route path="/stores"  element={<Suspense fallback={<Loading />}><GovtStores /></Suspense>} />
        <Route path="/mandi"   element={<Suspense fallback={<Loading />}><Mandi /></Suspense>} />

        {/* Protected */}
        <Route path="/dashboard"           element={<Protected><Dashboard /></Protected>} />
        <Route path="/crop-doctor/scanner" element={<Protected><Scanner /></Protected>} />
        <Route path="/farms"               element={<Protected><Farms /></Protected>} />
        <Route path="/weather"             element={<Protected><Weather /></Protected>} />
        <Route path="/assistant"           element={<Protected><Assistant /></Protected>} />
        <Route path="/calendar"            element={<Protected><Calendar /></Protected>} />
        <Route path="/expenses"            element={<Protected><Expenses /></Protected>} />
        <Route path="/marketplace"         element={<Protected><Marketplace /></Protected>} />
        <Route path="/scam-report"         element={<Protected><ScamReport /></Protected>} />
        <Route path="/settings"            element={<Protected><Settings /></Protected>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
