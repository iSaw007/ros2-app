import { NavLink } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { DockIcon, MapIcon, OverviewIcon, TeleopIcon } from "../components/ui/Icons";

type NavItem = {
  name: string;
  /** One word on what the page is for, shown when the rail is expanded. */
  hint: string;
  icon: React.ReactNode;
  path: string;
};

const navItems: NavItem[] = [
  { icon: <OverviewIcon />, name: "Overview", hint: "Status", path: "/" },
  { icon: <TeleopIcon />, name: "Teleop", hint: "Manual control", path: "/teleop" },
  { icon: <MapIcon />, name: "Navigation", hint: "Map and waypoints", path: "/navigation" },
  { icon: <DockIcon />, name: "Docking", hint: "Autonomous mission", path: "/docking" },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, closeMobileSidebar } = useSidebar();
  const showLabels = isExpanded || isMobileOpen;

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-edge bg-surface transition-[width,transform] duration-200 ease-out
      ${showLabels ? "w-[208px]" : "w-[56px]"}
      ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
      lg:translate-x-0`}
    >
      {/* Identity. The robot's name, not the template's. */}
      <div
        className={`flex h-12 shrink-0 items-center border-b border-edge ${
          showLabels ? "px-3" : "justify-center px-0"
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-accent text-[11px] font-bold text-accent-fg">
            Y
          </span>
          {showLabels && (
            <span className="truncate text-[13px] font-semibold tracking-tight">
              Yahboom Control
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                onClick={closeMobileSidebar}
                title={showLabels ? undefined : item.name}
                className={({ isActive }) =>
                  `flex items-center rounded-[5px] text-[13px] font-medium transition-colors ${
                    showLabels ? "gap-2.5 px-2.5 py-2" : "justify-center py-2.5"
                  } ${
                    isActive
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-sunken hover:text-ink"
                  }`
                }
              >
                <span className="shrink-0">{item.icon}</span>
                {showLabels && (
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate">{item.name}</span>
                    <span className="truncate text-[10px] font-normal text-faint">
                      {item.hint}
                    </span>
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default AppSidebar;
