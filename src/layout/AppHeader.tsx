import { useLocation } from "react-router";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import { useSidebar } from "../context/SidebarContext";
import { useRosStatus } from "../context/RosStatusContext";
import { useCameraDock } from "../context/CameraDockContext";
import { IconButton } from "../components/ui/Button";
import { CameraIcon, CameraOffIcon, CloseIcon, MenuIcon } from "../components/ui/Icons";
import { StatusLine, type Tone } from "../components/ui/Indicators";

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/teleop": "Teleop",
  "/navigation": "Navigation",
  "/docking": "Docking",
};

const linkState: Record<string, { tone: Tone; label: string; pulse: boolean }> = {
  connected: { tone: "ok", label: "Link up", pulse: false },
  connecting: { tone: "warn", label: "Reconnecting", pulse: true },
  disconnected: { tone: "danger", label: "Link down", pulse: false },
};

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const location = useLocation();
  const { status, url } = useRosStatus();
  const { isOpen: cameraOpen, toggle: toggleCamera } = useCameraDock();

  // The teleop page is the camera, so offering a corner copy of it there would
  // just open a second stream of the same pictures.
  const cameraToggleApplies = location.pathname !== "/teleop";

  const title = pageTitles[location.pathname] ?? "Robot Control";
  const link = linkState[status];

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-edge bg-surface px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconButton
          label={isMobileOpen ? "Close navigation" : "Toggle navigation"}
          variant="ghost"
          onClick={handleToggle}
        >
          {isMobileOpen ? <CloseIcon /> : <MenuIcon />}
        </IconButton>
        <h1 className="truncate text-[13px] font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* The bridge address is worth keeping permanently visible: it is the
            first thing to check when the link will not come up. */}
        <span className="tnum hidden text-[11px] text-faint md:inline">{url}</span>
        <StatusLine tone={link.tone} label={link.label} pulse={link.pulse} />
        {cameraToggleApplies && (
          <IconButton
            label={cameraOpen ? "Hide camera" : "Show camera"}
            variant="ghost"
            onClick={toggleCamera}
            className={cameraOpen ? "text-accent" : undefined}
          >
            {cameraOpen ? <CameraIcon /> : <CameraOffIcon />}
          </IconButton>
        )}
        <ThemeToggleButton />
      </div>
    </header>
  );
};

export default AppHeader;
