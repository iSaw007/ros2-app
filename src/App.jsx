import { BrowserRouter as Router, Routes, Route } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Overview from "./pages/Overview";
import TeleopMode from "./pages/TeleopMode";
import NavigationMode from "./pages/NavigationMode";
import MissionMode from "./pages/MissionMode";
import NotFound from "./pages/OtherPage/NotFound";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Overview />} />
            <Route path="/teleop" element={<TeleopMode />} />
            <Route path="/navigation" element={<NavigationMode />} />
            <Route path="/docking" element={<MissionMode />} />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
