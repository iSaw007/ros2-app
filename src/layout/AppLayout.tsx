import { Outlet } from "react-router";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { RosStatusProvider } from "../context/RosStatusContext";
import { CameraDockProvider } from "../context/CameraDockContext";
import { CameraDock } from "../components/CameraDock";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

// The shell is a fixed-height frame, not a scrolling document: the rail and the
// header stay put, and only the working area scrolls. A control station should
// never scroll a live reading out of view.
const LayoutContent: React.FC = () => {
  const { isExpanded } = useSidebar();

  return (
    <div className="h-screen overflow-hidden">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex h-full flex-col transition-[margin] duration-200 ease-out ${
          isExpanded ? "lg:ml-[208px]" : "lg:ml-[56px]"
        }`}
      >
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto p-3">
          <Outlet />
        </main>
      </div>
      <CameraDock />
    </div>
  );
};

const AppLayout: React.FC = () => (
  <RosStatusProvider>
    <SidebarProvider>
      <CameraDockProvider>
        <LayoutContent />
      </CameraDockProvider>
    </SidebarProvider>
  </RosStatusProvider>
);

export default AppLayout;
