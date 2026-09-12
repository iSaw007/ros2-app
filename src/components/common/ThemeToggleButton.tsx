import { useTheme } from "../../context/ThemeContext";
import { IconButton } from "../ui/Button";
import { MoonIcon, SunIcon } from "../ui/Icons";

export const ThemeToggleButton: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <IconButton
      label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      variant="ghost"
      onClick={toggleTheme}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  );
};
