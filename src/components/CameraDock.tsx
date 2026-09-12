import { useLocation } from "react-router";
import { CameraStream } from "./CameraStream";
import { DOCK_SIZES, useCameraDock } from "../context/CameraDockContext";
import { CloseIcon, CollapseIcon, ExpandIcon } from "./ui/Icons";

/**
 * A small camera view that stays available on every page.
 *
 * Driving, sending a waypoint, and watching a docking run all benefit from
 * seeing what the robot sees, but only the teleop page can justify giving the
 * feed the whole screen. This keeps it in the corner instead.
 *
 * It is deliberately absent on the teleop page, where the camera is already the
 * main subject: two <img> elements on one MJPEG topic mean two open HTTP
 * streams and twice the bandwidth, for no extra information.
 */
export const CameraDock: React.FC = () => {
  const { isOpen, size, close, cycleSize } = useCameraDock();
  const location = useLocation();

  if (!isOpen) return null;
  if (location.pathname === "/teleop") return null;

  const { width, height, quality } = DOCK_SIZES[size];

  return (
    <aside
      className="fixed bottom-3 right-3 z-30 overflow-hidden rounded-[6px] border border-edge bg-surface shadow-lg"
      style={{ width }}
      aria-label="Camera"
    >
      <header className="flex h-7 items-center justify-between gap-2 border-b border-edge px-2">
        <span className="field-label">Camera</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={cycleSize}
            title={size === "lg" ? "Shrink" : "Enlarge"}
            aria-label={size === "lg" ? "Shrink camera" : "Enlarge camera"}
            className="flex h-5 w-5 items-center justify-center rounded-[3px] text-faint transition-colors hover:bg-sunken hover:text-ink"
          >
            {size === "lg" ? <CollapseIcon size={12} /> : <ExpandIcon size={12} />}
          </button>
          <button
            onClick={close}
            title="Hide camera"
            aria-label="Hide camera"
            className="flex h-5 w-5 items-center justify-center rounded-[3px] text-faint transition-colors hover:bg-sunken hover:text-ink"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      </header>

      <div
        className="flex items-center justify-center bg-[var(--map-void)]"
        style={{ height }}
      >
        {/* Requested at display size and reduced quality — a corner view does
            not need a full-resolution stream. */}
        <CameraStream
          width={width}
          height={height}
          quality={quality}
          compact
          className="h-full w-full object-contain"
        />
      </div>
    </aside>
  );
};
