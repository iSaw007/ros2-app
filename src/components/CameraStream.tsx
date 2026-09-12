import { useEffect, useState } from "react";
import { WarningIcon } from "./ui/Icons";

type CameraStreamProps = {
  /** Requested stream width in pixels. Omit for the camera's native size. */
  width?: number;
  /** Requested stream height in pixels. */
  height?: number;
  /** JPEG quality, 1-100. Lower costs less bandwidth. */
  quality?: number;
  /** Extra classes for the <img>. */
  className?: string;
  /** Compact error text, for small surfaces like the dock. */
  compact?: boolean;
};

const HOST = import.meta.env.VITE_ROS_BRIDGE_IP;
const PORT = 8080;
const TOPIC = "/camera/image_raw";

/**
 * The robot's camera feed.
 *
 * web_video_server serves MJPEG over plain HTTP, so this is an <img> rather
 * than anything in the ROS connection — it deliberately does not go through
 * rosbridge, which would mean shipping every frame through the WebSocket.
 *
 * `width`/`height`/`quality` are passed to the server so the stream is encoded
 * at the size it will actually be displayed. That matters: at 640x480 a frame
 * is around 15 kB, and at 320x240 with reduced quality about 2.8 kB — roughly a
 * fifth of the bandwidth for a view a few centimetres across.
 *
 * The component must be unmounted, not merely hidden, to stop the stream. An
 * <img> with an MJPEG source holds the HTTP connection open and keeps frames
 * flowing for as long as it exists, however it is styled.
 */
export const CameraStream: React.FC<CameraStreamProps> = ({
  width,
  height,
  quality,
  className = "",
  compact = false,
}) => {
  const [failed, setFailed] = useState(false);
  // An MJPEG stream keeps delivering frames to a backgrounded tab, which costs
  // the robot bandwidth and power for pictures nobody is looking at. Dropping
  // the <img> while the tab is hidden closes the connection; it reopens on
  // return. Same reasoning as the dormant-by-default perception nodes.
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  // Changing this forces the browser to re-request the stream after a failure;
  // an <img> will not retry a src it has already given up on.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // A stream that failed while the robot was unreachable should recover once it
  // is back, without the operator having to do anything.
  useEffect(() => {
    if (!failed) return undefined;
    const retry = setTimeout(() => {
      setFailed(false);
      setAttempt((n) => n + 1);
    }, 5000);
    return () => clearTimeout(retry);
  }, [failed]);

  if (!tabVisible) {
    return <div className={className} aria-hidden="true" />;
  }

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-faint">
        <WarningIcon size={compact ? 16 : 22} />
        <p className={compact ? "text-[11px]" : "text-[13px] font-medium text-muted"}>
          No camera stream
        </p>
        {!compact && (
          <p className="max-w-xs text-xs leading-relaxed">
            Could not reach web_video_server at {HOST}:{PORT}. It is started by
            unified_bringup with video_server:=true. Retrying…
          </p>
        )}
      </div>
    );
  }

  // Built by hand rather than with URLSearchParams, which percent-encodes the
  // slashes in the topic name. web_video_server does not decode them and simply
  // drops the connection, so `topic=%2Fcamera%2Fimage_raw` yields no frames at
  // all while `topic=/camera/image_raw` works.
  const query = [
    `topic=${TOPIC}`,
    width ? `width=${width}` : null,
    height ? `height=${height}` : null,
    quality ? `quality=${quality}` : null,
    // Cache-buster so a retry re-requests rather than reusing the dead response.
    attempt ? `attempt=${attempt}` : null,
  ]
    .filter(Boolean)
    .join("&");

  return (
    <img
      key={attempt}
      src={`http://${HOST}:${PORT}/stream?${query}`}
      alt="Live camera feed from the robot"
      className={className}
      onError={() => setFailed(true)}
    />
  );
};
