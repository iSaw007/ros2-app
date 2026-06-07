import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useRosStatus } from '../context/RosStatusContext';
import { subscribeToPose, unsubscribeFromPose } from '../services/telemetryService';

// Small SVG compass rose showing the robot heading
function CompassRose({ yaw }) {
  const deg = (yaw * 180) / Math.PI;
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 dark:text-gray-600" />
      {/* Arrow pointing in heading direction */}
      <g transform={`rotate(${-deg}, 20, 20)`}>
        <polygon points="20,4 16,26 20,22 24,26" fill="#3b82f6" />
        <polygon points="20,36 16,14 20,18 24,14" fill="#94a3b8" />
      </g>
      <circle cx="20" cy="20" r="2" fill="#3b82f6" />
    </svg>
  );
}

const quickLinks = [
  { title: 'Teleop', to: '/teleop', description: 'Drive the robot and watch the camera stream.', icon: '🎮' },
  { title: 'Navigation', to: '/navigation', description: 'Click the map and send a waypoint goal.', icon: '🗺️' },
  { title: 'Docking', to: '/docking', description: 'Trigger the autonomous docking action.', icon: '🔌' },
];

export default function Overview() {
  const navigate = useNavigate();
  const { status, isConnected } = useRosStatus();
  const [pose, setPose] = useState(null);
  const [uptimeS, setUptimeS] = useState(0);

  // Subscribe to robot pose
  useEffect(() => {
    subscribeToPose((x, y, yaw) => setPose({ x, y, yaw }));
    return () => unsubscribeFromPose();
  }, []);

  // Uptime counter — resets when connection drops
  useEffect(() => {
    if (!isConnected) { setUptimeS(0); return; }
    const id = setInterval(() => setUptimeS(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [isConnected]);

  const formatUptime = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const statusConfig = {
    connected:    { label: 'Connected',     dot: 'bg-green-500',          card: 'border-green-100 dark:border-green-900',  text: 'text-green-700 dark:text-green-300' },
    connecting:   { label: 'Reconnecting…', dot: 'bg-amber-400 animate-pulse', card: 'border-amber-100 dark:border-amber-900', text: 'text-amber-700 dark:text-amber-300' },
    disconnected: { label: 'Offline',       dot: 'bg-red-500',            card: 'border-red-100 dark:border-red-900',    text: 'text-red-700 dark:text-red-300' },
  }[status];

  return (
    <div className="space-y-6">
      {/* Live telemetry grid */}
      <div className="grid gap-4 md:grid-cols-3">

        {/* Pose card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">Robot Pose</p>
          {pose ? (
            <div className="mt-3 flex items-center gap-4">
              <CompassRose yaw={pose.yaw} />
              <div className="font-mono text-sm text-gray-800 dark:text-gray-200 space-y-0.5">
                <div>X: <span className="text-blue-600 dark:text-blue-400">{pose.x.toFixed(3)}</span> m</div>
                <div>Y: <span className="text-blue-600 dark:text-blue-400">{pose.y.toFixed(3)}</span> m</div>
                <div>Yaw: <span className="text-blue-600 dark:text-blue-400">{pose.yaw.toFixed(3)}</span> rad</div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
              {isConnected ? 'Waiting for pose…' : 'No connection'}
            </p>
          )}
        </div>

        {/* Connection card */}
        <div className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900 ${statusConfig.card}`}>
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">ROS Bridge</p>
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusConfig.dot}`} />
            <span className={`font-semibold ${statusConfig.text}`}>{statusConfig.label}</span>
          </div>
          <p className="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400 truncate">
            {import.meta.env.VITE_ROS_BRIDGE_IP}:9090
          </p>
          {isConnected && (
            <p className="mt-1 font-mono text-xs text-gray-400 dark:text-gray-500">
              Uptime: {formatUptime(uptimeS)}
            </p>
          )}
        </div>

        {/* Quick actions card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">Quick Actions</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => navigate('/teleop')}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              🎮 Drive
            </button>
            <button
              onClick={() => navigate('/docking')}
              className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 transition hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              🔌 Dock
            </button>
          </div>
        </div>
      </div>

      {/* Page description */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Robot Control Station</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          Teleop, navigation, and docking in one place.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
          Use Teleop for manual driving, Navigation for map clicks and waypoint goals,
          and Docking for the autonomous visual docking mission.
        </p>
      </section>

      {/* Quick-link cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="text-2xl mb-2">{link.icon}</div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{link.title}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
