import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useRosStatus } from '../context/RosStatusContext';
import { subscribeToPose, getLastPose } from '../services/telemetryService';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Readout, StatusLine, EmptyState } from '../components/ui/Indicators';
import { DockIcon, MapIcon, TeleopIcon, LinkOffIcon } from '../components/ui/Icons';

/** Heading dial. A ring, a tick at north, and a needle — nothing else. */
function HeadingDial({ yaw }) {
  const degrees = (yaw * 180) / Math.PI;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="1" className="text-edge-strong" />
      {/* Cardinal ticks */}
      {[0, 90, 180, 270].map((angle) => (
        <line
          key={angle}
          x1="32" y1="7" x2="32" y2={angle === 0 ? 14 : 12}
          stroke="currentColor" strokeWidth={angle === 0 ? 1.75 : 1}
          className={angle === 0 ? 'text-muted' : 'text-edge-strong'}
          transform={`rotate(${angle} 32 32)`}
        />
      ))}
      {/* Needle. Negative rotation: yaw is counter-clockwise, SVG is clockwise. */}
      <g transform={`rotate(${-degrees} 32 32)`}>
        <path d="M32 11 L37 38 L32 34 L27 38 Z" fill="currentColor" className="text-accent" />
      </g>
      <circle cx="32" cy="32" r="2.5" fill="currentColor" className="text-accent" />
    </svg>
  );
}

const modes = [
  { to: '/teleop', name: 'Teleop', icon: <TeleopIcon size={20} />, description: 'Drive the robot by hand, with the camera feed and an emergency stop.' },
  { to: '/navigation', name: 'Navigation', icon: <MapIcon size={20} />, description: 'Place a waypoint on the occupancy grid and let Nav2 drive there.' },
  { to: '/docking', name: 'Docking', icon: <DockIcon size={20} />, description: 'Run the autonomous marker-guided docking mission and watch it progress.' },
];

/** Elapsed time as HH:MM:SS. */
const formatElapsed = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const linkStates = {
  connected:    { tone: 'ok',     label: 'Connected' },
  connecting:   { tone: 'warn',   label: 'Reconnecting' },
  disconnected: { tone: 'danger', label: 'Disconnected' },
};

export default function Overview() {
  const { status, isConnected, connectedSince, url, reconnect } = useRosStatus();
  const [pose, setPose] = useState(getLastPose);
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeToPose(setPose), []);

  // Drives the uptime readout. One timer, only while the link is actually up.
  useEffect(() => {
    if (!connectedSince) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [connectedSince]);

  const link = linkStates[status];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {/* Link. This is the panel that explains every other panel being empty,
            so it carries the address and a manual retry, not just a light. */}
        <Panel title="ROS bridge">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <StatusLine tone={link.tone} label={link.label} pulse={status === 'connecting'} />
              <Button size="sm" onClick={reconnect} disabled={isConnected}>
                Reconnect
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-edge pt-3">
              <div className="flex flex-col gap-1">
                <span className="field-label">Endpoint</span>
                <span className="tnum truncate text-[12px] text-muted" title={url}>{url}</span>
              </div>
              <Readout
                label="Link uptime"
                value={connectedSince ? formatElapsed(now - connectedSince) : '--:--:--'}
              />
            </div>
          </div>
        </Panel>

        {/* Pose, as estimated by AMCL. */}
        <Panel title="Estimated pose">
          {pose ? (
            <div className="flex items-center gap-5">
              <HeadingDial yaw={pose.yaw} />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <Readout label="X" value={pose.x.toFixed(2)} unit="m" />
                <Readout label="Y" value={pose.y.toFixed(2)} unit="m" />
                <Readout label="Yaw" value={pose.yaw.toFixed(2)} unit="rad" />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<LinkOffIcon size={22} />}
              title={isConnected ? 'No pose published yet' : 'Waiting for the robot'}
              hint={
                isConnected
                  ? 'AMCL publishes a pose once localisation is running and the robot has moved.'
                  : 'Pose appears once the ROS bridge connects.'
              }
            />
          )}
        </Panel>
      </div>

      <Panel title="Modes" flush>
        <ul className="divide-y divide-edge">
          {modes.map((mode) => (
            <li key={mode.to}>
              <Link
                to={mode.to}
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-sunken"
              >
                <span className="text-muted">{mode.icon}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-semibold">{mode.name}</span>
                  <span className="text-xs text-faint">{mode.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
