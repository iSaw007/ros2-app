import React, { useState } from 'react';
import { startDocking, cancelDocking } from '../services/dockingService';
import { sendBackup } from '../services/navigationService';

// All states in pipeline order
const PIPELINE = [
  'STAGING',
  'STAGING_CORRECTION',
  'SEARCHING',
  'TRACKING',
  'APPROACH',
  'DOCKED',
];

const STATE_LABELS = {
  STAGING:             'Staging',
  STAGING_CORRECTION:  'Correcting',
  SEARCHING:           'Searching',
  TRACKING:            'Tracking',
  APPROACH:            'Approach',
  DOCKED:              'Docked ✓',
};

function StatePipeline({ currentState, completedStates, failed }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PIPELINE.map((state, i) => {
        const isActive    = state === currentState;
        const isComplete  = completedStates.includes(state);
        const isFailed    = failed && isActive;
        const isFuture    = !isActive && !isComplete;

        let chipClass = 'px-3 py-1 rounded-full text-xs font-semibold border transition-all ';
        if (isFailed)    chipClass += 'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/40 dark:text-red-300';
        else if (isActive)   chipClass += 'bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-2 ring-blue-400/50 animate-pulse';
        else if (isComplete) chipClass += 'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/40 dark:text-green-300';
        else                 chipClass += 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500';

        return (
          <React.Fragment key={state}>
            <span className={chipClass}>{STATE_LABELS[state]}</span>
            {i < PIPELINE.length - 1 && (
              <span className="text-gray-300 dark:text-gray-600 text-xs">→</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DistanceGauge({ distanceM }) {
  const MAX_DIST = 2.0;
  const pct = Math.max(0, Math.min(1, 1 - distanceM / MAX_DIST)) * 100;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>Distance</span>
        <span className="font-mono">{distanceM.toFixed(2)} m</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>0 m</span>
        <span>{MAX_DIST} m</span>
      </div>
    </div>
  );
}

const LOG_COLORS = {
  state:   'text-blue-500 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  error:   'text-red-500 dark:text-red-400',
  info:    'text-gray-600 dark:text-gray-300',
};

const DOCK_IDS = ['default'];

export default function MissionMode() {
  const [logs, setLogs]             = useState([]);
  const [isDocking, setIsDocking]   = useState(false);
  const [isDocked, setIsDocked]     = useState(false);
  const [currentState, setCurrentState] = useState(null);
  const [completedStates, setCompletedStates] = useState([]);
  const [distanceM, setDistanceM]   = useState(null);
  const [failed, setFailed]         = useState(false);
  const [dockId, setDockId]         = useState('default');

  const appendLog = (text, level = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { text, level, ts, id: Date.now() + Math.random() }]);
  };

  const handleStart = () => {
    setIsDocking(true);
    setIsDocked(false);
    setFailed(false);
    setCurrentState('STAGING');
    setCompletedStates([]);
    setDistanceM(null);
    setLogs([]);
    appendLog(`Sending goal to dock: "${dockId}"`, 'info');

    startDocking(
      dockId,
      true,
      (feedback) => {
        const newState = feedback.state;
        const dist = feedback.distance_m ?? null;

        setCurrentState(prev => {
          if (prev && prev !== newState) {
            setCompletedStates(cs => cs.includes(prev) ? cs : [...cs, prev]);
            appendLog(`→ ${newState}`, 'state');
          }
          return newState;
        });
        if (dist !== null) setDistanceM(dist);
      },
      (result) => {
        setIsDocking(false);
        if (result.success) {
          setIsDocked(true);
          setCurrentState('DOCKED');
          setCompletedStates(PIPELINE.slice(0, -1));
          appendLog('Docking completed successfully!', 'success');
        } else {
          setFailed(true);
          appendLog(`Mission failed: ${result.message ?? 'unknown reason'}`, 'error');
        }
      }
    );
  };

  const handleCancel = () => {
    cancelDocking();
    setIsDocking(false);
    setFailed(true);
    appendLog('Mission cancelled by user.', 'error');
  };

  const handleUndock = () => {
    appendLog('Undocking…', 'info');
    // Fire the action but don't wait for its callback since the server doesn't exist yet
    sendBackup(0.4, 0.1, null, () => {});
    
    // Immediately reset UI state
    setIsDocked(false);
    setCurrentState(null);
    setCompletedStates([]);
    appendLog('UI reset (backup action simulated).', 'success');
  };

  const showGauge = distanceM !== null && (currentState === 'TRACKING' || currentState === 'APPROACH');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mission Control</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">
        Trigger autonomous docking and monitor real-time progress.
      </p>

      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          {/* Dock ID selector */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-2">
              Dock ID
            </label>
            <select
              value={dockId}
              onChange={e => setDockId(e.target.value)}
              disabled={isDocking}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {DOCK_IDS.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-3">
            {!isDocking && !isDocked && (
              <button
                onClick={handleStart}
                className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
              >
                🚀 Initiate Docking
              </button>
            )}
            {isDocking && (
              <button
                onClick={handleCancel}
                className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                ✕ Cancel Mission
              </button>
            )}
            {isDocked && !isDocking && (
              <button
                onClick={handleUndock}
                className="w-full py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-semibold transition-colors"
              >
                ↩ Undock
              </button>
            )}
            {!isDocking && !isDocked && failed && (
              <p className="text-xs text-center text-red-500">Mission failed. Ready to retry.</p>
            )}
          </div>

          {/* Status */}
          {currentState && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Status</p>
              <p className={`text-sm font-semibold ${
                isDocked ? 'text-green-600 dark:text-green-400' :
                failed   ? 'text-red-500' :
                           'text-blue-600 dark:text-blue-400'
              }`}>
                {STATE_LABELS[currentState] ?? currentState}
              </p>
              {showGauge && <DistanceGauge distanceM={distanceM} />}
            </div>
          )}
        </div>

        {/* Visual pipeline + log */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {/* Pipeline */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Mission Pipeline</p>
            {currentState ? (
              <StatePipeline
                currentState={currentState}
                completedStates={completedStates}
                failed={failed}
              />
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Start a mission to see the state pipeline.
              </p>
            )}
          </div>

          {/* Log */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col flex-1 h-[320px]">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Mission Log
            </p>
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded-lg font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-400">No active mission. Click "Initiate Docking" to start.</p>
              ) : (
                logs.map(entry => (
                  <div key={entry.id} className="mb-1 flex gap-2">
                    <span className="text-gray-400 shrink-0">[{entry.ts}]</span>
                    <span className={LOG_COLORS[entry.level]}>{entry.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
