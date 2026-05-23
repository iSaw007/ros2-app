import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { BoxCubeIcon, GridIcon, PageIcon, PlugInIcon } from "../icons";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
};

const navItems: NavItem[] = [
  { icon: <GridIcon />, name: "Overview", path: "/" },
  { icon: <BoxCubeIcon />, name: "Teleop", path: "/teleop" },
  { icon: <PageIcon />, name: "Navigation", path: "/navigation" },
  { icon: <PlugInIcon />, name: "Docking", path: "/docking" },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 lg:mt-0
      ${isExpanded || isMobileOpen || isHovered ? "w-[280px]" : "w-[90px]"}
      ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
      lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex py-8 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <GridIcon />
          </div>
          {(isExpanded || isHovered || isMobileOpen) && (
            <div>
              <p className="text-sm font-semibold">Robot App</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Control station</p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1">
        <ul className="flex flex-col gap-3">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive(item.path)
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                } ${!isExpanded && !isHovered ? "lg:justify-center" : ""}`}
              >
                <span
                  className={`flex items-center justify-center ${
                    isActive(item.path)
                      ? "text-blue-600 dark:text-blue-300"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {item.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && <span>{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default AppSidebar;
