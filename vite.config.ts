import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind on all interfaces so the dashboard can be opened from a phone or a
    // laptop on the same network as the robot, not just from this machine.
    host: true,
  },
});
