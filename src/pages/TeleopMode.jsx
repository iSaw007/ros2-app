import React, { useState, useEffect, useRef } from 'react';
import { Joystick } from 'react-joystick-component';
import { drive, stop } from '../services/teleopService';

const MAX_LINEAR  = 0.5;  // m/s
const MAX_ANGULAR = 1.0;  // rad/s

// Key → [linear delta, angular delta]
const KEY_MAP = {
  w: [1, 0], ArrowUp: [1, 0],
  s: [-1, 0], ArrowDown: [-1, 0],
  a: [0, 1], ArrowLeft: [0, 1],
  d: [0, -1], ArrowRight: [0, -1],
};

export default function TeleopMode() {
  const [currentLinear, setCurrentLinear]   = useState(0);
  const [currentAngular, setCurrentAngular] = useState(0);
  const [isEstopped, setIsEstopped]         = useState(false);
  const [streamError, setStreamError]       = useState(false);

  const pressedKeys = useRef(new Set());
  const estopped    = useRef(false);

  // Keep ref in sync with state (avoids stale closure in interval)
  useEffect(() => { estopped.current = isEstopped; }, [isEstopped]);

  // Keyboard control — 10 Hz publish loop
  useEffect(() => {
    const onDown = (e) => {
      if (KEY_MAP[e.key]) { e.preventDefault(); pressedKeys.current.add(e.key); }
    };
    const onUp   = (e) => pressedKeys.current.delete(e.key);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const interval = setInterval(() => {
      if (estopped.current) return;
      let lin = 0, ang = 0;
      pressedKeys.current.forEach(k => {
        const [dl, da] = KEY_MAP[k] ?? [0, 0];
        lin += dl; ang += da;
      });
      lin = Math.max(-1, Math.min(1, lin)) * MAX_LINEAR;
      ang = Math.max(-1, Math.min(1, ang)) * MAX_ANGULAR;

      if (pressedKeys.current.size > 0) {
        drive(lin, ang);
        setCurrentLinear(lin);
        setCurrentAngular(ang);
      } else {
        // No keys held — ensure robot is stopped (only publish once)
        if (lin !== 0 || ang !== 0) {
          stop();
          setCurrentLinear(0);
          setCurrentAngular(0);
        }
      }
    }, 100);

    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      clearInterval(interval);
    };
  }, []);

  const handleMove = (event) => {
    if (isEstopped) return;
    const lin =  event.y * MAX_LINEAR;
    const ang = -event.x * MAX_ANGULAR;
    drive(lin, ang);
    setCurrentLinear(lin);
    setCurrentAngular(ang);
  };

  const handleJoystickStop = () => {
    if (isEstopped) return;
    stop();
    setCurrentLinear(0);
    setCurrentAngular(0);
  };

  const handleEstop = () => {
    stop();
    setIsEstopped(true);
    setCurrentLinear(0);
    setCurrentAngular(0);
    pressedKeys.current.clear();
  };

  const handleResume = () => setIsEstopped(false);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Teleop Mode</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">
        Live camera stream and joystick controls. Use WASD / arrow keys or drag the joystick.
      </p>

      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Camera Stream */}
        <div className="col-span-12 lg:col-span-8">
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-black shadow-sm">
            {streamError ? (
              <div className="w-full h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                </svg>
                <p className="text-sm">Stream unavailable — check rosbridge IP</p>
              </div>
            ) : (
              <img
                src={`http://${import.meta.env.VITE_ROS_BRIDGE_IP}:8080/stream?topic=/camera/image_raw`}
                alt="Robot Camera Stream"
                className="w-full h-auto"
                onError={() => setStreamError(true)}
              />
            )}
          </div>
        </div>

        {/* Controls Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          {/* E-Stop */}
          <button
            onClick={isEstopped ? handleResume : handleEstop}
            className={`w-full py-3 rounded-xl font-bold text-white text-lg transition-all shadow-md ${
              isEstopped
                ? 'bg-gray-500 hover:bg-gray-600 animate-pulse'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isEstopped ? '▶ Resume' : '⛔ E-STOP'}
          </button>

          {/* Joystick card */}
          <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl border shadow-sm flex flex-col items-center gap-4 transition-all ${
            isEstopped
              ? 'border-red-400 dark:border-red-600 ring-2 ring-red-400/40'
              : 'border-gray-100 dark:border-gray-700'
          }`}>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white self-start">Virtual Joystick</h2>

            <Joystick
              size={120}
              sticky={false}
              baseColor={isEstopped ? '#fca5a5' : '#e2e8f0'}
              stickColor={isEstopped ? '#ef4444' : '#3b82f6'}
              move={handleMove}
              stop={handleJoystickStop}
            />

            {/* Speed readout */}
            <div className="w-full font-mono text-xs grid grid-cols-2 gap-2">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                <p className="text-gray-400 mb-0.5">Linear</p>
                <p className={currentLinear >= 0 ? 'text-blue-500' : 'text-amber-500'}>
                  {currentLinear >= 0 ? '+' : ''}{currentLinear.toFixed(3)} m/s
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                <p className="text-gray-400 mb-0.5">Angular</p>
                <p className={currentAngular >= 0 ? 'text-blue-500' : 'text-amber-500'}>
                  {currentAngular >= 0 ? '+' : ''}{currentAngular.toFixed(3)} rad/s
                </p>
              </div>
            </div>
          </div>

          {/* Keyboard legend */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Keyboard</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-gray-600 dark:text-gray-300">
              <span><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">W</kbd> / <kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">↑</kbd> Forward</span>
              <span><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">S</kbd> / <kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">↓</kbd> Reverse</span>
              <span><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">A</kbd> / <kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">←</kbd> Left</span>
              <span><kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">D</kbd> / <kbd className="bg-gray-100 dark:bg-gray-700 px-1 rounded">→</kbd> Right</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
